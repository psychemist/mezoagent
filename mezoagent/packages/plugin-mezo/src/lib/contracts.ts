/**
 * Smart Contract Interfaces
 * 
 * Defines interfaces and ABIs for Mezo smart contracts including:
 * - Smart Account contracts (EIP-402)
 * - Session Key Manager
 * - Tigris DEX
 * - Upshift Vaults
 */

import type { MezoRpcClient } from './rpc-client';

export interface ContractConfig {
    address: string;
    abi: readonly unknown[];
    rpcClient: MezoRpcClient;
}

/**
 * Base contract interface
 */
export abstract class BaseContract {
    protected address: string;
    protected abi: readonly unknown[];
    protected rpcClient: MezoRpcClient;

    constructor(config: ContractConfig) {
        this.address = config.address;
        this.abi = config.abi;
        this.rpcClient = config.rpcClient;
    }

    /**
     * Encode function call data
     */
    protected encodeFunctionData(functionName: string, params: unknown[]): string {
        // In a real implementation, this would use ethers.js or viem's ABI encoder
        // For now, this is a placeholder that would need proper ABI encoding
        throw new Error('ABI encoding not implemented - requires ethers.js or viem');
    }

    /**
     * Decode function result
     */
    protected decodeFunctionResult(functionName: string, data: string): unknown {
        // In a real implementation, this would use ethers.js or viem's ABI decoder
        throw new Error('ABI decoding not implemented - requires ethers.js or viem');
    }

    /**
     * Call a view function
     */
    protected async call(functionName: string, params: unknown[]): Promise<string> {
        const data = this.encodeFunctionData(functionName, params);
        return this.rpcClient.call({
            to: this.address,
            data,
        });
    }

    getAddress(): string {
        return this.address;
    }
}

/**
 * Smart Account Contract (EIP-402)
 */
export interface SmartAccountConfig extends ContractConfig {
    entryPoint?: string;
}

export class SmartAccountContract extends BaseContract {
    private entryPoint: string;

    constructor(config: SmartAccountConfig) {
        super(config);
        this.entryPoint = config.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    }

    /**
     * Get the account's nonce
     */
    async getNonce(): Promise<bigint> {
        // This would call the account's nonce() function
        const result = await this.call('nonce', []);
        return BigInt(result);
    }

    /**
     * Validate a user operation
     */
    async validateUserOp(userOp: {
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
    }): Promise<boolean> {
        // This would validate the user operation signature
        const result = await this.call('validateUserOp', [userOp]);
        return BigInt(result) !== 0n;
    }

    /**
     * Execute a transaction from the smart account
     */
    async execute(to: string, value: bigint, data: string): Promise<string> {
        // This would encode and execute the transaction
        const result = await this.call('execute', [to, value, data]);
        return result;
    }
}

/**
 * Session Key Manager Contract
 */
export interface SessionKey {
    key: string;
    permissions: string[];
    expiry: bigint;
    maxSpend: bigint;
    rateLimit: bigint;
}

export class SessionKeyManagerContract extends BaseContract {
    /**
     * Check if a session key is valid
     */
    async isValidSessionKey(account: string, sessionKey: string): Promise<boolean> {
        const result = await this.call('isValidSessionKey', [account, sessionKey]);
        return BigInt(result) !== 0n;
    }

    /**
     * Get session key permissions
     */
    async getPermissions(account: string, sessionKey: string): Promise<string[]> {
        const result = await this.call('getPermissions', [account, sessionKey]);
        // Decode the result to get permissions array
        return this.decodeFunctionResult('getPermissions', result) as string[];
    }

    /**
     * Register a new session key
     */
    async registerSessionKey(sessionKey: SessionKey): Promise<string> {
        // This would create a transaction to register the session key
        throw new Error('Transaction creation requires signing - use transaction builder');
    }

    /**
     * Revoke a session key
     */
    async revokeSessionKey(sessionKey: string): Promise<string> {
        throw new Error('Transaction creation requires signing - use transaction builder');
    }
}

/**
 * Tigris DEX Contract Interface
 */
export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOutMin: bigint;
    to: string;
    deadline: bigint;
}

export class TigrisDexContract extends BaseContract {
    /**
     * Get the amount of tokens out for a given amount in
     */
    async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> {
        const result = await this.call('getAmountsOut', [amountIn, path]);
        return this.decodeFunctionResult('getAmountsOut', result) as bigint[];
    }

    /**
     * Get the amount of tokens in for a given amount out
     */
    async getAmountsIn(amountOut: bigint, path: string[]): Promise<bigint[]> {
        const result = await this.call('getAmountsIn', [amountOut, path]);
        return this.decodeFunctionResult('getAmountsIn', result) as bigint[];
    }

    /**
     * Execute a swap
     */
    async swap(params: SwapParams): Promise<string> {
        throw new Error('Transaction creation requires signing - use transaction builder');
    }

    /**
     * Get the current price for a token pair
     */
    async getPrice(tokenA: string, tokenB: string): Promise<bigint> {
        const reserves = await this.call('getReserves', [tokenA, tokenB]);
        // Decode and calculate price
        return BigInt(reserves);
    }
}

/**
 * Upshift Vault Contract Interface
 */
export class UpshiftVaultContract extends BaseContract {
    /**
     * Get the current APY for a vault
     */
    async getAPY(): Promise<bigint> {
        const result = await this.call('getAPY', []);
        return BigInt(result);
    }

    /**
     * Get the total value locked
     */
    async getTVL(): Promise<bigint> {
        const result = await this.call('getTVL', []);
        return BigInt(result);
    }

    /**
     * Get user's deposit balance
     */
    async getBalance(account: string): Promise<bigint> {
        const result = await this.call('balanceOf', [account]);
        return BigInt(result);
    }

    /**
     * Deposit assets into the vault
     */
    async deposit(amount: bigint): Promise<string> {
        throw new Error('Transaction creation requires signing - use transaction builder');
    }

    /**
     * Withdraw assets from the vault
     */
    async withdraw(amount: bigint): Promise<string> {
        throw new Error('Transaction creation requires signing - use transaction builder');
    }
}

/**
 * Contract addresses for Mezo chain
 * These should be configured via environment variables
 */
export const CONTRACT_ADDRESSES = {
    SMART_ACCOUNT_FACTORY: process.env.MEZO_SMART_ACCOUNT_FACTORY || '0x0000000000000000000000000000000000000000',
    SESSION_KEY_MANAGER: process.env.MEZO_SESSION_KEY_MANAGER || '0x0000000000000000000000000000000000000000',
    TIGRIS_DEX: process.env.MEZO_TIGRIS_DEX || '0x0000000000000000000000000000000000000000',
    UPSHIFT_VAULT_BTC: process.env.MEZO_UPSHIFT_VAULT_BTC || '0x0000000000000000000000000000000000000000',
    ENTRY_POINT: process.env.MEZO_ENTRY_POINT || '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
} as const;

/**
 * Minimal ABIs for contract interactions
 * In production, these should be full ABIs from the contract deployments
 */
export const ABIS = {
    SMART_ACCOUNT: [
        'function nonce() view returns (uint256)',
        'function execute(address to, uint256 value, bytes data)',
        'function validateUserOp((address,uint256,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256) returns (uint256)',
    ],
    SESSION_KEY_MANAGER: [
        'function isValidSessionKey(address account, address sessionKey) view returns (bool)',
        'function getPermissions(address account, address sessionKey) view returns (bytes32[])',
        'function registerSessionKey(address sessionKey, bytes32[] permissions, uint256 expiry, uint256 maxSpend, uint256 rateLimit)',
        'function revokeSessionKey(address sessionKey)',
    ],
    TIGRIS_DEX: [
        'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
        'function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)',
        'function swap(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
        'function getReserves(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB)',
    ],
    UPSHIFT_VAULT: [
        'function getAPY() view returns (uint256)',
        'function getTVL() view returns (uint256)',
        'function balanceOf(address account) view returns (uint256)',
        'function deposit(uint256 amount)',
        'function withdraw(uint256 amount)',
    ],
} as const;

