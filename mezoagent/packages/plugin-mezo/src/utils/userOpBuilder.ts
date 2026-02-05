/**
 * UserOperation Builder for EIP-4337 Account Abstraction
 * Constructs and validates UserOperations for gasless transactions
 */

import { ethers } from 'ethers';
import type {
  UserOperation,
  UserOpParams,
  GasEstimate,
  ValidationResult,
  Operation,
} from '../types/x402';

// EntryPoint contract address (EIP-4337 standard)
const ENTRYPOINT_ADDRESS = process.env.MEZO_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

/**
 * Build a UserOperation from parameters
 */
export function buildUserOp(params: UserOpParams): UserOperation {
  const {
    sender,
    target,
    value,
    data,
    usePaymaster = false,
  } = params;

  // Encode the call data
  const callData = encodeExecuteCall(target, value, data);

  // Create base UserOperation
  const userOp: UserOperation = {
    sender,
    nonce: 0n, // Will be fetched from chain
    initCode: '0x', // Empty for existing accounts
    callData,
    callGasLimit: 0n, // Will be estimated
    verificationGasLimit: 0n, // Will be estimated
    preVerificationGas: 0n, // Will be estimated
    maxFeePerGas: 0n, // Will be set from fee data
    maxPriorityFeePerGas: 0n, // Will be set from fee data
    paymasterAndData: usePaymaster ? '0x' : '0x', // Will be populated if using paymaster
    signature: '0x', // Will be signed later
  };

  return userOp;
}

/**
 * Encode execute call for smart account
 */
function encodeExecuteCall(target: string, value: bigint, data: string): string {
  // Standard execute(address,uint256,bytes) function
  const executeAbi = ['function execute(address target, uint256 value, bytes calldata data)'];
  const iface = new ethers.Interface(executeAbi);

  return iface.encodeFunctionData('execute', [target, value, data]);
}

/**
 * Estimate gas for UserOperation
 */
export async function estimateGas(
  provider: ethers.JsonRpcProvider,
  userOp: UserOperation
): Promise<GasEstimate> {
  try {
    // Get current fee data
    const feeData = await provider.getFeeData();

    const gasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei');
    const maxFeePerGas = feeData.maxFeePerGas || gasPrice;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

    // Estimate gas limits
    // In production, these would be estimated via eth_estimateUserOperationGas
    const callGasLimit = 200000n;
    const verificationGasLimit = 100000n;
    const preVerificationGas = 21000n;

    const totalGasLimit = callGasLimit + verificationGasLimit + preVerificationGas;
    const totalCost = totalGasLimit * maxFeePerGas;

    return {
      gasLimit: totalGasLimit,
      gasPrice: BigInt(gasPrice.toString()),
      maxFeePerGas: BigInt(maxFeePerGas.toString()),
      maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas.toString()),
      totalCost,
    };
  } catch (error) {
    console.error('Error estimating UserOperation gas:', error);
    throw error;
  }
}

/**
 * Sign UserOperation
 */
export async function signUserOp(
  userOp: UserOperation,
  signer: ethers.Wallet,
  chainId: number
): Promise<UserOperation> {
  try {
    // Create UserOperation hash according to EIP-4337
    const userOpHash = getUserOpHash(userOp, ENTRYPOINT_ADDRESS, chainId);

    // Sign the hash
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));

    // Return UserOperation with signature
    return {
      ...userOp,
      signature,
    };
  } catch (error) {
    console.error('Error signing UserOperation:', error);
    throw error;
  }
}

/**
 * Get UserOperation hash (EIP-4337 standard)
 */
function getUserOpHash(userOp: UserOperation, entryPoint: string, chainId: number): string {
  // Pack UserOperation according to EIP-4337
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address', 'uint256', 'bytes32', 'bytes32',
      'uint256', 'uint256', 'uint256', 'uint256',
      'uint256', 'bytes32'
    ],
    [
      userOp.sender,
      userOp.nonce,
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );

  const userOpHash = ethers.keccak256(packed);

  // Encode with entryPoint and chainId
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId]
  );

  return ethers.keccak256(encoded);
}

/**
 * Bundle multiple operations into a single UserOperation
 */
export function bundleOperations(operations: Operation[]): UserOperation {
  if (operations.length === 0) {
    throw new Error('No operations to bundle');
  }

  // For simplicity, we'll use the first operation's sender
  const sender = process.env.MEZO_SMART_ACCOUNT_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Encode multiple calls
  const targets: string[] = [];
  const values: bigint[] = [];
  const datas: string[] = [];

  for (const op of operations) {
    // Extract target, value, and data from operation params
    targets.push(op.params.target || '0x0000000000000000000000000000000000000000');
    values.push(op.params.value || 0n);
    datas.push(op.params.data || '0x');
  }

  // Encode batch execute call
  const callData = encodeBatchExecuteCall(targets, values, datas);

  // Calculate total gas needed
  const totalGas = operations.reduce((sum, op) => sum + op.estimatedGas, 0n);

  const userOp: UserOperation = {
    sender,
    nonce: 0n,
    initCode: '0x',
    callData,
    callGasLimit: totalGas,
    verificationGasLimit: 100000n,
    preVerificationGas: 21000n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    paymasterAndData: '0x',
    signature: '0x',
  };

  return userOp;
}

/**
 * Encode batch execute call
 */
function encodeBatchExecuteCall(
  targets: string[],
  values: bigint[],
  datas: string[]
): string {
  // Standard executeBatch(address[],uint256[],bytes[]) function
  const executeBatchAbi = [
    'function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata datas)'
  ];
  const iface = new ethers.Interface(executeBatchAbi);

  return iface.encodeFunctionData('executeBatch', [targets, values, datas]);
}

/**
 * Validate UserOperation
 */
export function validateUserOp(userOp: UserOperation): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check sender
  if (!ethers.isAddress(userOp.sender)) {
    errors.push('Invalid sender address');
  }

  // Check callData
  if (!userOp.callData || userOp.callData === '0x') {
    errors.push('CallData is empty');
  }

  // Check gas limits
  if (userOp.callGasLimit === 0n) {
    warnings.push('CallGasLimit is zero - needs estimation');
  }

  if (userOp.verificationGasLimit === 0n) {
    warnings.push('VerificationGasLimit is zero - needs estimation');
  }

  if (userOp.preVerificationGas === 0n) {
    warnings.push('PreVerificationGas is zero - needs estimation');
  }

  // Check fee data
  if (userOp.maxFeePerGas === 0n) {
    warnings.push('MaxFeePerGas is zero - needs to be set');
  }

  // Check signature
  if (!userOp.signature || userOp.signature === '0x') {
    warnings.push('UserOperation is not signed');
  }

  // Check total gas cost
  const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
  if (totalGas > 10000000n) {
    warnings.push('Total gas limit is very high - may fail');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get nonce for smart account
 */
export async function getNonce(
  provider: ethers.JsonRpcProvider,
  sender: string,
  entryPoint: string = ENTRYPOINT_ADDRESS
): Promise<bigint> {
  try {
    // Call getNonce on EntryPoint contract
    const entryPointAbi = ['function getNonce(address sender, uint192 key) view returns (uint256)'];
    const contract = new ethers.Contract(entryPoint, entryPointAbi, provider);

    const nonce = await contract.getNonce(sender, 0);
    return BigInt(nonce.toString());
  } catch (error) {
    console.error('Error fetching nonce:', error);
    return 0n;
  }
}

/**
 * Complete UserOperation with all required fields
 */
export async function completeUserOp(
  provider: ethers.JsonRpcProvider,
  userOp: UserOperation,
  signer: ethers.Wallet,
  chainId: number
): Promise<UserOperation> {
  // Get nonce
  const nonce = await getNonce(provider, userOp.sender);
  userOp.nonce = nonce;

  // Estimate gas
  const gasEstimate = await estimateGas(provider, userOp);
  userOp.callGasLimit = 200000n;
  userOp.verificationGasLimit = 100000n;
  userOp.preVerificationGas = 21000n;
  userOp.maxFeePerGas = gasEstimate.maxFeePerGas;
  userOp.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;

  // Sign UserOperation
  const signedUserOp = await signUserOp(userOp, signer, chainId);

  return signedUserOp;
}
