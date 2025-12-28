/**
 * Transaction Builder
 * 
 * Constructs and signs transactions for the Mezo chain.
 * Supports both regular EOA transactions and EIP-402 UserOperations.
 */

import type { MezoRpcClient } from './rpc-client';
import type { SmartAccountContract, SwapParams, SessionKey } from './contracts';

export interface TransactionRequest {
    to?: string;
    value?: bigint;
    data?: string;
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    nonce?: number;
    chainId?: number;
}

export interface UserOperation {
    sender: string;
    nonce: bigint;
    callData: string;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}

export interface Signer {
    address: string;
    signMessage(message: string | Uint8Array): Promise<string>;
    signTransaction(tx: TransactionRequest): Promise<string>;
}

export class TransactionBuilder {
    private rpcClient: MezoRpcClient;
    private chainId: number;
    private signer?: Signer;
    private smartAccount?: SmartAccountContract;

    constructor(
        rpcClient: MezoRpcClient,
        chainId: number = parseInt(process.env.MEZO_CHAIN_ID || '1', 10),
        signer?: Signer,
        smartAccount?: SmartAccountContract
    ) {
        this.rpcClient = rpcClient;
        this.chainId = chainId;
        this.signer = signer;
        this.smartAccount = smartAccount;
    }

    /**
     * Set the signer for transaction signing
     */
    setSigner(signer: Signer): void {
        this.signer = signer;
    }

    /**
     * Set the smart account for user operations
     */
    setSmartAccount(smartAccount: SmartAccountContract): void {
        this.smartAccount = smartAccount;
    }

    /**
     * Build a regular EOA transaction
     */
    async buildTransaction(request: TransactionRequest): Promise<TransactionRequest> {
        const from = this.signer?.address;
        if (!from) {
            throw new Error('Signer address required for transaction building');
        }

        // Get nonce if not provided
        if (request.nonce === undefined) {
            request.nonce = await this.rpcClient.getTransactionCount(from);
        }

        // Get gas price if not provided
        if (!request.gasPrice && !request.maxFeePerGas) {
            const gasPrice = await this.getGasPrice();
            request.maxFeePerGas = gasPrice;
            request.maxPriorityFeePerGas = gasPrice / 2n;
        }

        // Estimate gas if not provided
        if (!request.gasLimit && request.to) {
            try {
                request.gasLimit = await this.rpcClient.estimateGas({
                    from,
                    to: request.to,
                    value: request.value,
                    data: request.data,
                });
                // Add 20% buffer
                request.gasLimit = (request.gasLimit * 120n) / 100n;
            } catch (error) {
                console.warn('Gas estimation failed, using default:', error);
                request.gasLimit = 21000n; // Default gas limit
            }
        }

        request.chainId = this.chainId;

        return request;
    }

    /**
     * Sign and send a regular transaction
     */
    async signAndSend(request: TransactionRequest): Promise<string> {
        if (!this.signer) {
            throw new Error('Signer required for transaction signing');
        }

        const tx = await this.buildTransaction(request);
        const signedTx = await this.signer.signTransaction(tx);
        
        return this.rpcClient.sendRawTransaction(signedTx);
    }

    /**
     * Build a UserOperation for EIP-402 account abstraction
     */
    async buildUserOperation(params: {
        to: string;
        value?: bigint;
        data: string;
        paymaster?: string;
        paymasterData?: string;
    }): Promise<UserOperation> {
        if (!this.smartAccount) {
            throw new Error('Smart account required for user operations');
        }

        const sender = this.smartAccount.getAddress();
        const nonce = await this.smartAccount.getNonce();

        // Encode the execute call
        const callData = this.encodeExecuteCall(params.to, params.value || 0n, params.data);

        // Estimate gas
        const callGasLimit = await this.estimateCallGas(callData);
        const verificationGasLimit = 100000n; // Default verification gas
        const preVerificationGas = 21000n; // Default pre-verification gas

        // Get gas prices
        const maxFeePerGas = await this.getGasPrice();
        const maxPriorityFeePerGas = maxFeePerGas / 2n;

        // Paymaster data
        const paymasterAndData = params.paymaster 
            ? this.encodePaymasterData(params.paymaster, params.paymasterData || '0x')
            : '0x';

        // Signature will be added after building
        const signature = '0x';

        return {
            sender,
            nonce,
            callData,
            callGasLimit,
            verificationGasLimit,
            preVerificationGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            paymasterAndData,
            signature,
        };
    }

    /**
     * Sign a UserOperation
     */
    async signUserOperation(userOp: UserOperation): Promise<UserOperation> {
        if (!this.signer) {
            throw new Error('Signer required for user operation signing');
        }

        // Get the user operation hash
        const userOpHash = await this.getUserOpHash(userOp);
        
        // Sign the hash
        const signature = await this.signer.signMessage(userOpHash);
        
        return {
            ...userOp,
            signature,
        };
    }

    /**
     * Build a swap transaction for Tigris DEX
     */
    async buildSwapTransaction(params: SwapParams): Promise<TransactionRequest> {
        // This would encode the swap function call
        // For now, return a placeholder
        return {
            to: process.env.MEZO_TIGRIS_DEX || '0x0000000000000000000000000000000000000000',
            data: this.encodeSwapCall(params),
            value: 0n,
        };
    }

    /**
     * Build a deposit transaction for Upshift vault
     */
    async buildDepositTransaction(
        vaultAddress: string,
        amount: bigint
    ): Promise<TransactionRequest> {
        return {
            to: vaultAddress,
            data: this.encodeDepositCall(amount),
            value: 0n,
        };
    }

    /**
     * Build a withdraw transaction for Upshift vault
     */
    async buildWithdrawTransaction(
        vaultAddress: string,
        amount: bigint
    ): Promise<TransactionRequest> {
        return {
            to: vaultAddress,
            data: this.encodeWithdrawCall(amount),
            value: 0n,
        };
    }

    /**
     * Get current gas price
     */
    private async getGasPrice(): Promise<bigint> {
        try {
            const result = await this.rpcClient.request<string>('eth_gasPrice', []);
            return BigInt(result);
        } catch (error) {
            console.warn('Failed to fetch gas price, using default:', error);
            return 20000000000n; // 20 gwei default
        }
    }

    /**
     * Estimate gas for a call
     */
    private async estimateCallGas(callData: string): Promise<bigint> {
        if (!this.smartAccount) {
            return 100000n; // Default
        }

        try {
            const gas = await this.rpcClient.estimateGas({
                to: this.smartAccount.getAddress(),
                data: callData,
            });
            return gas;
        } catch (error) {
            console.warn('Gas estimation failed, using default:', error);
            return 100000n;
        }
    }

    /**
     * Get user operation hash for signing
     */
    private async getUserOpHash(userOp: UserOperation): Promise<string> {
        // In a real implementation, this would use the EntryPoint's getUserOpHash function
        // For now, return a placeholder
        const entryPoint = process.env.MEZO_ENTRY_POINT || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
        
        // This would call entryPoint.getUserOpHash(userOp)
        throw new Error('UserOp hash calculation requires EntryPoint contract call');
    }

    /**
     * Encode execute call for smart account
     */
    private encodeExecuteCall(to: string, value: bigint, data: string): string {
        // Function selector for execute(address,uint256,bytes)
        const selector = '0xb61d27f6';
        // ABI encode the parameters
        // This is simplified - in production, use proper ABI encoding
        return selector + this.padAddress(to) + this.padUint256(value) + this.encodeBytes(data);
    }

    /**
     * Encode swap call for Tigris DEX
     */
    private encodeSwapCall(params: SwapParams): string {
        // Function selector for swap(uint256,uint256,address[],address,uint256)
        const selector = '0x38ed1739';
        // ABI encode parameters
        // Simplified - use proper ABI encoding in production
        return selector;
    }

    /**
     * Encode deposit call
     */
    private encodeDepositCall(amount: bigint): string {
        // Function selector for deposit(uint256)
        const selector = '0x6e553f65';
        return selector + this.padUint256(amount);
    }

    /**
     * Encode withdraw call
     */
    private encodeWithdrawCall(amount: bigint): string {
        // Function selector for withdraw(uint256)
        const selector = '0x2e1a7d4d';
        return selector + this.padUint256(amount);
    }

    /**
     * Encode paymaster data
     */
    private encodePaymasterData(paymaster: string, data: string): string {
        return paymaster + data.slice(2);
    }

    /**
     * Utility: Pad address to 32 bytes
     */
    private padAddress(address: string): string {
        return address.slice(2).padStart(64, '0');
    }

    /**
     * Utility: Pad uint256 to 32 bytes
     */
    private padUint256(value: bigint): string {
        return value.toString(16).padStart(64, '0');
    }

    /**
     * Utility: Encode bytes
     */
    private encodeBytes(data: string): string {
        const dataHex = data.startsWith('0x') ? data.slice(2) : data;
        const length = dataHex.length / 2;
        return this.padUint256(BigInt(length)) + dataHex.padEnd(64, '0');
    }
}

