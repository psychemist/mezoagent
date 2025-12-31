/**
 * X402 Provider - Core Self-Autonomous Payment Logic
 * Manages treasury, gas estimation, and payment routing for the Mezo Agent
 */

import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';
import { ethers } from 'ethers';
import { createMezoRpcClient } from '../lib/rpc-client';
import type {
    TreasuryState,
    GasEstimate,
    PaymentRoute,
    FeasibilityResult,
    X402Config,
} from '../types/x402';

// Default X402 configuration
const DEFAULT_X402_CONFIG: X402Config = {
    enabled: true,
    treasury: {
        minReserve: ethers.parseEther('10'), // 10 MEZO
        warningThreshold: ethers.parseEther('20'), // 20 MEZO
        criticalThreshold: ethers.parseEther('5'), // 5 MEZO
        autoRefundEnabled: true,
        supportedTokens: ['MEZO', 'BTC', 'USDC'],
    },
    gas: {
        maxGasPrice: ethers.parseUnits('100', 'gwei'),
        optimizationEnabled: true,
        batchingEnabled: true,
        gasMultiplier: 1.2,
        priorityFee: ethers.parseUnits('2', 'gwei'),
    },
    paymaster: {
        enabled: true,
        endpoint: process.env.MEZO_PAYMASTER_ENDPOINT || 'https://paymaster.mezo.org',
        fallbackToDirectPayment: true,
        preferredStrategy: 'token-based',
    },
    limits: {
        maxOperationCost: ethers.parseEther('1'), // 1 MEZO
        maxOperationsPerHour: 100,
        maxDailySpend: ethers.parseEther('50'), // 50 MEZO
    },
    funding: {
        sources: ['upshift-yields', 'external-wallet'],
        autoHarvestEnabled: true,
        harvestThreshold: ethers.parseEther('5'), // 5 MEZO
        emergencyFundingAddress: process.env.MEZO_EMERGENCY_FUNDING_ADDRESS,
    },
};

// Token addresses
const TOKEN_ADDRESSES = {
    MEZO: process.env.MEZO_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    BTC: process.env.MEZO_TBTC_ADDRESS || '0x0000000000000000000000000000000000000000',
    USDC: process.env.MEZO_USDC_ADDRESS || '0x0000000000000000000000000000000000000000',
} as const;

const SMART_ACCOUNT_ADDRESS = process.env.MEZO_SMART_ACCOUNT_ADDRESS || '0x0000000000000000000000000000000000000000';

// Gas price cache
let gasPriceCache: { price: bigint; timestamp: number } | null = null;
const GAS_PRICE_CACHE_DURATION = 30000; // 30 seconds

// Treasury state cache
let treasuryStateCache: { state: TreasuryState; timestamp: number } | null = null;
const TREASURY_CACHE_DURATION = 60000; // 1 minute

/**
 * Get token balance from blockchain
 */
async function getTokenBalance(
    provider: ethers.JsonRpcProvider,
    tokenAddress: string,
    accountAddress: string
): Promise<bigint> {
    try {
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            return 0n;
        }

        const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        const balance = await contract.balanceOf(accountAddress);
        return BigInt(balance.toString());
    } catch (error) {
        console.error(`Error fetching balance for token ${tokenAddress}:`, error);
        return 0n;
    }
}

/**
 * Get current gas price with caching
 */
async function getCurrentGasPrice(provider: ethers.JsonRpcProvider): Promise<bigint> {
    const now = Date.now();

    // Return cached value if still valid
    if (gasPriceCache && (now - gasPriceCache.timestamp) < GAS_PRICE_CACHE_DURATION) {
        return gasPriceCache.price;
    }

    try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei');

        gasPriceCache = {
            price: BigInt(gasPrice.toString()),
            timestamp: now,
        };

        return gasPriceCache.price;
    } catch (error) {
        console.error('Error fetching gas price:', error);
        return ethers.parseUnits('50', 'gwei'); // Fallback to 50 gwei
    }
}

/**
 * Get treasury state
 */
async function getTreasuryState(
    provider: ethers.JsonRpcProvider,
    config: X402Config
): Promise<TreasuryState> {
    const now = Date.now();

    // Return cached state if still valid
    if (treasuryStateCache && (now - treasuryStateCache.timestamp) < TREASURY_CACHE_DURATION) {
        return treasuryStateCache.state;
    }

    const balances: { [token: string]: bigint } = {};

    // Fetch balances for all supported tokens
    for (const token of config.treasury.supportedTokens) {
        const tokenAddress = TOKEN_ADDRESSES[token as keyof typeof TOKEN_ADDRESSES];
        if (tokenAddress) {
            balances[token] = await getTokenBalance(provider, tokenAddress, SMART_ACCOUNT_ADDRESS);
        }
    }

    // Get native balance (ETH/MEZO)
    const nativeBalance = await provider.getBalance(SMART_ACCOUNT_ADDRESS);
    balances['NATIVE'] = BigInt(nativeBalance.toString());

    // Calculate total value (simplified - in production, use price oracles)
    const totalValueUSD = Object.values(balances).reduce((sum, balance) => {
        return sum + Number(ethers.formatEther(balance)) * 50000; // Mock price
    }, 0);

    // Calculate burn rate (tokens per day) - would use historical data in production
    const burnRate = 0.5; // Mock: 0.5 MEZO per day

    // Calculate runway
    const primaryBalance = balances['MEZO'] || balances['NATIVE'] || 0n;
    const runwayDays = burnRate > 0
        ? Number(ethers.formatEther(primaryBalance)) / burnRate
        : Infinity;

    const state: TreasuryState = {
        balances,
        totalValueUSD,
        lastUpdated: now,
        burnRate,
        runwayDays,
    };

    treasuryStateCache = { state, timestamp: now };
    return state;
}

/**
 * Estimate gas for an operation
 */
async function estimateOperationGas(
    provider: ethers.JsonRpcProvider,
    action: string,
    _params: any,
    config: X402Config
): Promise<GasEstimate> {
    try {
        const gasPrice = await getCurrentGasPrice(provider);

        // Estimate gas limit based on operation type
        let gasLimit: bigint;
        switch (action) {
            case 'swap':
                gasLimit = 200000n; // Typical DEX swap
                break;
            case 'deposit':
                gasLimit = 150000n; // Deposit to yield protocol
                break;
            case 'withdraw':
                gasLimit = 180000n; // Withdraw from yield protocol
                break;
            default:
                gasLimit = 100000n; // Default estimate
        }

        // Apply gas multiplier for safety
        gasLimit = (gasLimit * BigInt(Math.floor(config.gas.gasMultiplier * 100))) / 100n;

        const maxFeePerGas = gasPrice;
        const maxPriorityFeePerGas = config.gas.priorityFee;
        const totalCost = gasLimit * maxFeePerGas;

        return {
            gasLimit,
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
            totalCost,
        };
    } catch (error) {
        console.error('Error estimating gas:', error);
        throw error;
    }
}

/**
 * Check if operation is affordable
 */
async function checkAffordability(
    treasuryState: TreasuryState,
    estimatedCost: bigint,
    config: X402Config
): Promise<FeasibilityResult> {
    const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;
    const requiredAmount = estimatedCost + config.treasury.minReserve;

    if (primaryBalance >= requiredAmount) {
        return {
            canAfford: true,
            reason: 'Sufficient treasury balance',
            currentBalance: primaryBalance,
            requiredAmount,
        };
    }

    const shortfall = requiredAmount - primaryBalance;

    // Determine suggested action
    let suggestedAction: 'refund' | 'wait' | 'reduce-amount';
    if (primaryBalance < config.treasury.criticalThreshold) {
        suggestedAction = 'refund';
    } else if (shortfall < ethers.parseEther('1')) {
        suggestedAction = 'wait';
    } else {
        suggestedAction = 'reduce-amount';
    }

    return {
        canAfford: false,
        reason: 'Insufficient treasury balance',
        currentBalance: primaryBalance,
        requiredAmount,
        shortfall,
        suggestedAction,
    };
}

/**
 * Select optimal payment method
 */
async function selectPaymentRoute(
    treasuryState: TreasuryState,
    estimatedCost: bigint,
    config: X402Config
): Promise<PaymentRoute> {
    // Check if paymaster is available and enabled
    if (config.paymaster.enabled) {
        return {
            method: 'paymaster',
            token: 'SPONSORED',
            estimatedCost: 0n,
            reason: 'Using paymaster for gasless transaction',
        };
    }

    // Check MEZO balance
    const mezoBalance = treasuryState.balances['MEZO'] || 0n;
    if (mezoBalance >= estimatedCost) {
        return {
            method: 'direct',
            token: 'MEZO',
            estimatedCost,
            reason: 'Sufficient MEZO balance for direct payment',
        };
    }

    // Check native balance
    const nativeBalance = treasuryState.balances['NATIVE'] || 0n;
    if (nativeBalance >= estimatedCost) {
        return {
            method: 'direct',
            token: 'NATIVE',
            estimatedCost,
            reason: 'Using native token for gas payment',
        };
    }

    // Fallback to token swap if needed
    const usdcBalance = treasuryState.balances['USDC'] || 0n;
    if (usdcBalance > 0n) {
        return {
            method: 'token-swap',
            token: 'USDC',
            estimatedCost: estimatedCost * 110n / 100n, // Add 10% for swap costs
            reason: 'Swapping USDC to pay for gas',
        };
    }

    return {
        method: 'direct',
        token: 'MEZO',
        estimatedCost,
        reason: 'Insufficient funds - refund required',
    };
}

/**
 * Get paymaster address if available
 */
function getPaymasterAddress(config: X402Config): string | null {
    if (!config.paymaster.enabled) {
        return null;
    }
    return process.env.MEZO_PAYMASTER_ADDRESS || null;
}

/**
 * X402 Provider - Injects payment context into agent runtime
 */
export const x402Provider: Provider = {
    name: 'X402_PAYMENT',
    description: 'Provides self-autonomous payment capabilities and treasury management',
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        try {
            // Load configuration
            const config = DEFAULT_X402_CONFIG;

            // Create provider
            const _rpcClient = createMezoRpcClient();
            const provider = new ethers.JsonRpcProvider(
                process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
            );

            // Get treasury state
            const treasuryState = await getTreasuryState(provider, config);

            // Get current gas price
            const gasPrice = await getCurrentGasPrice(provider);

            // Calculate treasury health
            const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;
            let healthStatus: 'healthy' | 'warning' | 'critical' | 'emergency';

            if (primaryBalance >= config.treasury.warningThreshold) {
                healthStatus = 'healthy';
            } else if (primaryBalance >= config.treasury.criticalThreshold) {
                healthStatus = 'warning';
            } else if (primaryBalance > 0n) {
                healthStatus = 'critical';
            } else {
                healthStatus = 'emergency';
            }

            const contextText = `
X402 Payment System Status:
Treasury Health: ${healthStatus.toUpperCase()}
Primary Balance: ${ethers.formatEther(primaryBalance)} MEZO
Runway: ${treasuryState.runwayDays.toFixed(1)} days
Current Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei
Paymaster: ${config.paymaster.enabled ? 'ENABLED' : 'DISABLED'}
Auto-Refund: ${config.treasury.autoRefundEnabled ? 'ENABLED' : 'DISABLED'}

Supported Tokens: ${config.treasury.supportedTokens.join(', ')}
            `.trim();

            return {
                values: {
                    treasuryHealth: healthStatus,
                    primaryBalance: primaryBalance.toString(),
                    runwayDays: treasuryState.runwayDays,
                    gasPrice: gasPrice.toString(),
                    paymasterEnabled: config.paymaster.enabled,
                },
                data: {
                    treasuryState,
                    config,
                    gasPrice,
                },
                text: contextText,
            };
        } catch (error) {
            console.error('Error in x402Provider:', error);
            return {
                values: {},
                data: undefined,
                text: `Error fetching X402 payment data: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};

/**
 * Helper functions exported for use in actions
 */
export const x402Utils = {
    getTreasuryState,
    estimateOperationGas,
    checkAffordability,
    selectPaymentRoute,
    getPaymasterAddress,
    getCurrentGasPrice,
};
