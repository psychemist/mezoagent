g/**
 * Treasury Management Provider
 * Autonomously maintains operational funds for the Mezo Agent
 */

import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';
import { ethers } from 'ethers';
import type {
    TreasuryMetrics,
    HealthStatus,
    RefundResult,
    HarvestResult,
    X402Config,
} from '../types/x402';
import { x402Utils } from './x402Provider';

// Historical spending tracking
interface SpendingRecord {
    timestamp: number;
    amount: bigint;
    operation: string;
}

const spendingHistory: SpendingRecord[] = [];
const MAX_HISTORY_SIZE = 1000;

/**
 * Record a spending transaction
 */
export function recordSpending(amount: bigint, operation: string): void {
    spendingHistory.push({
        timestamp: Date.now(),
        amount,
        operation,
    });

    // Keep history size manageable
    if (spendingHistory.length > MAX_HISTORY_SIZE) {
        spendingHistory.shift();
    }
}

/**
 * Calculate burn rate from historical data
 */
function calculateBurnRate(): number {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Get spending in last 24 hours
    const recentSpending = spendingHistory.filter(record => record.timestamp >= oneDayAgo);

    if (recentSpending.length === 0) {
        return 0;
    }

    const totalSpent = recentSpending.reduce((sum, record) => sum + record.amount, 0n);
    return Number(ethers.formatEther(totalSpent));
}

/**
 * Calculate runway days
 */
function calculateRunway(currentBalance: bigint, burnRate: number): number {
    if (burnRate === 0) {
        return Infinity;
    }

    const balanceInEther = Number(ethers.formatEther(currentBalance));
    return balanceInEther / burnRate;
}

/**
 * Get spending in last 24 hours
 */
function getSpending24h(): bigint {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentSpending = spendingHistory.filter(record => record.timestamp >= oneDayAgo);
    return recentSpending.reduce((sum, record) => sum + record.amount, 0n);
}

/**
 * Get operation count in last 24 hours
 */
function getOperationCount24h(): number {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return spendingHistory.filter(record => record.timestamp >= oneDayAgo).length;
}

/**
 * Determine treasury health status
 */
function determineHealthStatus(
    balance: bigint,
    warningThreshold: bigint,
    criticalThreshold: bigint
): HealthStatus {
    if (balance >= warningThreshold) {
        return 'healthy';
    } else if (balance >= criticalThreshold) {
        return 'warning';
    } else if (balance > 0n) {
        return 'critical';
    } else {
        return 'emergency';
    }
}

/**
 * Harvest yields from Upshift positions
 */
export async function harvestYields(_runtime: IAgentRuntime): Promise<HarvestResult> {
    try {
        // This would integrate with the Upshift protocol to claim yields
        // For now, we'll return a mock result

        console.log('🌾 Harvesting yields from Upshift positions...');

        // In production, this would:
        // 1. Query Upshift positions for available yields
        // 2. Execute claim transaction
        // 3. Transfer claimed tokens to treasury

        const mockHarvested = ethers.parseEther('2.5'); // Mock: harvested 2.5 MEZO

        return {
            success: true,
            harvested: mockHarvested,
            token: 'MEZO',
            depositedToTreasury: mockHarvested,
            txHash: '0xMockHarvestTxHash...',
        };
    } catch (error) {
        console.error('Error harvesting yields:', error);
        return {
            success: false,
            harvested: 0n,
            token: 'MEZO',
            depositedToTreasury: 0n,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Auto-refund treasury from configured sources
 */
export async function autoRefund(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<RefundResult> {
    try {
        console.log('💰 Initiating auto-refund...');

        // Try each funding source in order
        for (const source of config.funding.sources) {
            switch (source) {
                case 'upshift-yields': {
                    const harvestResult = await harvestYields(runtime);
                    if (harvestResult.success && harvestResult.harvested > 0n) {
                        return {
                            success: true,
                            amount: harvestResult.harvested,
                            source: 'upshift-yields',
                            txHash: harvestResult.txHash,
                        };
                    }
                    break;
                }

                case 'external-wallet': {
                    // In production, this would transfer from an external wallet
                    if (config.funding.emergencyFundingAddress) {
                        console.log('Requesting funds from external wallet...');

                        // Mock transfer
                        const transferAmount = ethers.parseEther('10');

                        return {
                            success: true,
                            amount: transferAmount,
                            source: 'external-wallet',
                            txHash: '0xMockExternalTransferTxHash...',
                        };
                    }
                    break;
                }

                case 'credit-line': {
                    // In production, this would draw from a credit line
                    console.log('Drawing from credit line...');

                    const creditAmount = ethers.parseEther('5');

                    return {
                        success: true,
                        amount: creditAmount,
                        source: 'credit-line',
                        txHash: '0xMockCreditLineTxHash...',
                    };
                }
            }
        }

        return {
            success: false,
            amount: 0n,
            source: 'upshift-yields',
            error: 'No funding sources available',
        };
    } catch (error) {
        console.error('Error in auto-refund:', error);
        return {
            success: false,
            amount: 0n,
            source: 'upshift-yields',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Rebalance treasury across multiple tokens
 */
export async function rebalanceTreasury(_runtime: IAgentRuntime): Promise<void> {
    try {
        console.log('⚖️ Rebalancing treasury...');

        // In production, this would:
        // 1. Analyze current token distribution
        // 2. Determine optimal allocation based on upcoming needs
        // 3. Execute swaps to rebalance

        // For now, this is a placeholder
        console.log('Treasury rebalancing complete');
    } catch (error) {
        console.error('Error rebalancing treasury:', error);
    }
}

/**
 * Monitor treasury health continuously
 */
export async function monitorHealth(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<void> {
    try {
        const provider = new ethers.JsonRpcProvider(
            process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
        );

        const treasuryState = await x402Utils.getTreasuryState(provider, config);
        const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;

        const healthStatus = determineHealthStatus(
            primaryBalance,
            config.treasury.warningThreshold,
            config.treasury.criticalThreshold
        );

        // Trigger auto-refund if below critical threshold
        if (healthStatus === 'critical' || healthStatus === 'emergency') {
            if (config.treasury.autoRefundEnabled) {
                console.log(`⚠️ Treasury health ${healthStatus} - triggering auto-refund`);
                await autoRefund(runtime, config);
            }
        }

        // Auto-harvest if enabled and threshold met
        if (config.funding.autoHarvestEnabled) {
            const _harvestThreshold = config.funding.harvestThreshold;
            // In production, check if yields >= threshold before harvesting
            // For now, we'll skip automatic harvesting
        }
    } catch (error) {
        console.error('Error monitoring treasury health:', error);
    }
}

/**
 * Get current treasury metrics
 */
async function getTreasuryMetrics(
    _runtime: IAgentRuntime,
    config: X402Config
): Promise<TreasuryMetrics> {
    const provider = new ethers.JsonRpcProvider(
        process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
    );

    const treasuryState = await x402Utils.getTreasuryState(provider, config);
    const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;

    const burnRate = calculateBurnRate();
    const runwayDays = calculateRunway(primaryBalance, burnRate);
    const healthStatus = determineHealthStatus(
        primaryBalance,
        config.treasury.warningThreshold,
        config.treasury.criticalThreshold
    );

    const totalSpent24h = getSpending24h();
    const operationCount24h = getOperationCount24h();

    // Calculate utilization rate (simplified)
    const totalTreasuryValue = Object.values(treasuryState.balances).reduce((sum, bal) => sum + bal, 0n);
    const utilizationRate = totalTreasuryValue > 0n
        ? Number((primaryBalance * 100n) / totalTreasuryValue)
        : 0;

    return {
        status: healthStatus,
        currentBalance: primaryBalance,
        burnRate,
        runwayDays,
        utilizationRate,
        lastRefund: Date.now(), // Would track actual last refund time
        totalSpent24h,
        operationCount24h,
    };
}

/**
 * Treasury Provider - Exposes treasury health metrics
 */
export const treasuryProvider: Provider = {
    name: 'TREASURY_HEALTH',
    description: 'Provides real-time treasury health metrics and management capabilities',
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        try {
            // Load configuration
            const config = {
                enabled: true,
                treasury: {
                    minReserve: ethers.parseEther('10'),
                    warningThreshold: ethers.parseEther('20'),
                    criticalThreshold: ethers.parseEther('5'),
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
                    preferredStrategy: 'token-based' as const,
                },
                limits: {
                    maxOperationCost: ethers.parseEther('1'),
                    maxOperationsPerHour: 100,
                    maxDailySpend: ethers.parseEther('50'),
                },
                funding: {
                    sources: ['upshift-yields', 'external-wallet'] as Array<'upshift-yields' | 'external-wallet' | 'credit-line'>,
                    autoHarvestEnabled: true,
                    harvestThreshold: ethers.parseEther('5'),
                    emergencyFundingAddress: process.env.MEZO_EMERGENCY_FUNDING_ADDRESS,
                },
            };

            const metrics = await getTreasuryMetrics(runtime, config);

            const statusEmoji = {
                healthy: '✅',
                warning: '⚠️',
                critical: '🚨',
                emergency: '🆘',
            };

            const contextText = `
Treasury Health Report:
Status: ${statusEmoji[metrics.status]} ${metrics.status.toUpperCase()}
Current Balance: ${ethers.formatEther(metrics.currentBalance)} MEZO
Burn Rate: ${metrics.burnRate.toFixed(4)} MEZO/day
Runway: ${metrics.runwayDays === Infinity ? '∞' : metrics.runwayDays.toFixed(1)} days
Utilization: ${metrics.utilizationRate.toFixed(1)}%

Last 24 Hours:
- Total Spent: ${ethers.formatEther(metrics.totalSpent24h)} MEZO
- Operations: ${metrics.operationCount24h}
            `.trim();

            return {
                values: {
                    status: metrics.status,
                    balance: metrics.currentBalance.toString(),
                    burnRate: metrics.burnRate,
                    runwayDays: metrics.runwayDays,
                    spent24h: metrics.totalSpent24h.toString(),
                    operations24h: metrics.operationCount24h,
                },
                data: metrics as unknown as Record<string, unknown>,
                text: contextText,
            };
        } catch (error) {
            console.error('Error in treasuryProvider:', error);
            return {
                values: {},
                data: undefined,
                text: `Error fetching treasury data: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
