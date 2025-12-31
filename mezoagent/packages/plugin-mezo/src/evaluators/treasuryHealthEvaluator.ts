/**
 * Treasury Health Monitor Evaluator
 * Continuous monitoring system for treasury health with automated alerts and refunding
 */

import { type IAgentRuntime, type Memory, type Evaluator, type State } from '@elizaos/core';
import { ethers } from 'ethers';
import { x402Utils } from '../providers/x402Provider';
import { autoRefund, harvestYields } from '../providers/treasuryProvider';
import type {
    TreasuryMetrics,
    HealthStatus,
    X402Config,
} from '../types/x402';

// Monitoring state
let monitoringInterval: NodeJS.Timeout | null = null;
let lastHealthStatus: HealthStatus | null = null;
let alertsSent: Set<string> = new Set();

// Default configuration
const DEFAULT_CONFIG: X402Config = {
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
        preferredStrategy: 'token-based',
    },
    limits: {
        maxOperationCost: ethers.parseEther('1'),
        maxOperationsPerHour: 100,
        maxDailySpend: ethers.parseEther('50'),
    },
    funding: {
        sources: ['upshift-yields', 'external-wallet'],
        autoHarvestEnabled: true,
        harvestThreshold: ethers.parseEther('5'),
    },
};

/**
 * Calculate burn rate from spending history
 */
function calculateBurnRate(metrics: TreasuryMetrics): number {
    // Burn rate is already calculated in treasury provider
    return metrics.burnRate;
}

/**
 * Calculate runway days
 */
function calculateRunway(balance: bigint, burnRate: number): number {
    if (burnRate === 0) {
        return Infinity;
    }

    const balanceInEther = Number(ethers.formatEther(balance));
    return balanceInEther / burnRate;
}

/**
 * Check treasury health thresholds
 */
function checkThresholds(
    balance: bigint,
    config: X402Config
): HealthStatus {
    if (balance >= config.treasury.warningThreshold) {
        return 'healthy';
    } else if (balance >= config.treasury.criticalThreshold) {
        return 'warning';
    } else if (balance > 0n) {
        return 'critical';
    } else {
        return 'emergency';
    }
}

/**
 * Trigger alert for health status change
 */
async function triggerAlert(
    status: HealthStatus,
    metrics: TreasuryMetrics,
    runtime: IAgentRuntime
): Promise<void> {
    const alertKey = `${status}_${Date.now()}`;

    // Prevent duplicate alerts within 5 minutes
    const recentAlerts = Array.from(alertsSent).filter(key => {
        const timestamp = parseInt(key.split('_')[1]);
        return Date.now() - timestamp < 5 * 60 * 1000;
    });

    if (recentAlerts.some(key => key.startsWith(status))) {
        return; // Already sent alert for this status recently
    }

    alertsSent.add(alertKey);

    // Cleanup old alerts
    if (alertsSent.size > 100) {
        const sorted = Array.from(alertsSent).sort();
        alertsSent = new Set(sorted.slice(-50));
    }

    const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        critical: '🚨',
        emergency: '🆘',
    };

    const message = `
${statusEmoji[status]} Treasury Health Alert: ${status.toUpperCase()}

Current Balance: ${ethers.formatEther(metrics.currentBalance)} MEZO
Burn Rate: ${metrics.burnRate.toFixed(4)} MEZO/day
Runway: ${metrics.runwayDays === Infinity ? '∞' : metrics.runwayDays.toFixed(1)} days
Utilization: ${metrics.utilizationRate.toFixed(1)}%

Last 24h:
- Spent: ${ethers.formatEther(metrics.totalSpent24h)} MEZO
- Operations: ${metrics.operationCount24h}
    `.trim();

    console.log('\n' + '='.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\n');

    // In production, send to webhook, Discord, Telegram, etc.
    if (process.env.TREASURY_ALERT_WEBHOOK) {
        try {
            await fetch(process.env.TREASURY_ALERT_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    message,
                    metrics,
                    timestamp: Date.now(),
                }),
            });
        } catch (error) {
            console.error('Failed to send webhook alert:', error);
        }
    }
}

/**
 * Auto-trigger refunding when balance is low
 */
async function triggerAutoRefund(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<void> {
    try {
        console.log('💰 Auto-refund triggered by treasury health monitor');
        const result = await autoRefund(runtime, config);

        if (result.success) {
            console.log(`✅ Auto-refund successful: ${ethers.formatEther(result.amount)} MEZO from ${result.source}`);
        } else {
            console.error(`❌ Auto-refund failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error in auto-refund:', error);
    }
}

/**
 * Auto-harvest yields when threshold is met
 */
async function triggerAutoHarvest(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<void> {
    try {
        console.log('🌾 Auto-harvest triggered by treasury health monitor');
        const result = await harvestYields(runtime);

        if (result.success) {
            console.log(`✅ Auto-harvest successful: ${ethers.formatEther(result.harvested)} ${result.token}`);
        } else {
            console.error(`❌ Auto-harvest failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error in auto-harvest:', error);
    }
}

/**
 * Export treasury metrics for dashboard
 */
async function exportMetrics(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<TreasuryMetrics> {
    const provider = new ethers.JsonRpcProvider(
        process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
    );

    const treasuryState = await x402Utils.getTreasuryState(provider, config);
    const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;

    const burnRate = treasuryState.burnRate;
    const runwayDays = calculateRunway(primaryBalance, burnRate);
    const status = checkThresholds(primaryBalance, config);

    // Calculate utilization
    const totalValue = Object.values(treasuryState.balances).reduce((sum, bal) => sum + bal, 0n);
    const utilizationRate = totalValue > 0n
        ? Number((primaryBalance * 100n) / totalValue)
        : 0;

    return {
        status,
        currentBalance: primaryBalance,
        burnRate,
        runwayDays,
        utilizationRate,
        lastRefund: Date.now(), // Would track actual last refund
        totalSpent24h: 0n, // Would get from spending history
        operationCount24h: 0, // Would get from spending history
    };
}

/**
 * Monitor treasury health (called periodically)
 */
export async function monitorHealth(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<void> {
    try {
        const metrics = await exportMetrics(runtime, config);
        const currentStatus = metrics.status;

        // Check if status changed
        if (currentStatus !== lastHealthStatus) {
            console.log(`📊 Treasury status changed: ${lastHealthStatus || 'unknown'} → ${currentStatus}`);
            await triggerAlert(currentStatus, metrics, runtime);
            lastHealthStatus = currentStatus;
        }

        // Auto-refund if critical or emergency
        if ((currentStatus === 'critical' || currentStatus === 'emergency') && config.treasury.autoRefundEnabled) {
            await triggerAutoRefund(runtime, config);
        }

        // Auto-harvest if enabled
        if (config.funding.autoHarvestEnabled) {
            // Check if yields are above threshold (would query Upshift contract)
            // For now, we'll skip this check
        }

        // Log current status
        console.log(`💰 Treasury: ${ethers.formatEther(metrics.currentBalance)} MEZO | Status: ${currentStatus} | Runway: ${metrics.runwayDays.toFixed(1)}d`);
    } catch (error) {
        console.error('Error in treasury health monitoring:', error);
    }
}

/**
 * Start continuous monitoring
 */
export function startMonitoring(runtime: IAgentRuntime, config: X402Config): void {
    if (monitoringInterval) {
        console.log('⚠️  Treasury monitoring already running');
        return;
    }

    console.log('🔍 Starting treasury health monitoring (every 60 seconds)...');

    // Run immediately
    monitorHealth(runtime, config);

    // Then run every minute
    monitoringInterval = setInterval(() => {
        monitorHealth(runtime, config);
    }, 60 * 1000);
}

/**
 * Stop continuous monitoring
 */
export function stopMonitoring(): void {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('🛑 Treasury monitoring stopped');
    }
}

/**
 * Generate daily treasury report
 */
export async function generateDailyReport(
    runtime: IAgentRuntime,
    config: X402Config
): Promise<string> {
    const metrics = await exportMetrics(runtime, config);

    const report = `
📊 Daily Treasury Report
========================

Health Status: ${metrics.status.toUpperCase()}
Current Balance: ${ethers.formatEther(metrics.currentBalance)} MEZO
Burn Rate: ${metrics.burnRate.toFixed(4)} MEZO/day
Runway: ${metrics.runwayDays === Infinity ? '∞' : metrics.runwayDays.toFixed(1)} days
Utilization: ${metrics.utilizationRate.toFixed(1)}%

Last 24 Hours:
- Total Spent: ${ethers.formatEther(metrics.totalSpent24h)} MEZO
- Operations: ${metrics.operationCount24h}
- Average Cost: ${metrics.operationCount24h > 0 ? ethers.formatEther(metrics.totalSpent24h / BigInt(metrics.operationCount24h)) : '0'} MEZO/op

Thresholds:
- Warning: ${ethers.formatEther(config.treasury.warningThreshold)} MEZO
- Critical: ${ethers.formatEther(config.treasury.criticalThreshold)} MEZO
- Min Reserve: ${ethers.formatEther(config.treasury.minReserve)} MEZO

Auto-Refund: ${config.treasury.autoRefundEnabled ? 'ENABLED' : 'DISABLED'}
Auto-Harvest: ${config.funding.autoHarvestEnabled ? 'ENABLED' : 'DISABLED'}
    `.trim();

    return report;
}

/**
 * Treasury Health Evaluator
 */
export const treasuryHealthEvaluator: Evaluator = {
    name: 'TREASURY_HEALTH',
    description: 'Monitors treasury health and triggers alerts/refunding when needed',
    similes: ['TREASURY_CHECK', 'BALANCE_MONITOR', 'HEALTH_CHECK'],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const config = DEFAULT_CONFIG;
            const metrics = await exportMetrics(runtime, config);

            // Return true if treasury is healthy or warning, false if critical/emergency
            return metrics.status === 'healthy' || metrics.status === 'warning';
        } catch (error) {
            console.error('Error in treasury health evaluator:', error);
            return false;
        }
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const config = DEFAULT_CONFIG;
            const metrics = await exportMetrics(runtime, config);

            return {
                status: metrics.status,
                balance: ethers.formatEther(metrics.currentBalance) + ' MEZO',
                burnRate: metrics.burnRate.toFixed(4) + ' MEZO/day',
                runway: metrics.runwayDays === Infinity ? '∞' : metrics.runwayDays.toFixed(1) + ' days',
                healthy: metrics.status === 'healthy' || metrics.status === 'warning',
            };
        } catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                healthy: false,
            };
        }
    },
    examples: [
        {
            context: 'Checking treasury health before operation',
            messages: [
                {
                    user: '{{user1}}',
                    content: { text: 'Check treasury health' },
                },
            ],
            outcome: 'Evaluator returns current treasury status and metrics',
        },
    ],
};

/**
 * Exported utilities
 */
export const treasuryHealthUtils = {
    calculateBurnRate,
    calculateRunway,
    checkThresholds,
    triggerAlert,
    triggerAutoRefund,
    triggerAutoHarvest,
    exportMetrics,
    monitorHealth,
    startMonitoring,
    stopMonitoring,
    generateDailyReport,
};
