/**
 * Gas Optimization Engine
 * Minimizes transaction costs through intelligent batching, timing, and strategy selection
 */

import { type IAgentRuntime, type Action, type Memory, type State, type HandlerCallback } from '@elizaos/core';
import { ethers } from 'ethers';
import type {
    Operation,
    GasStrategy,
    Urgency,
    X402Config,
} from '../types/x402';
import { x402Utils } from '../providers/x402Provider';

// Gas price history for prediction
interface GasPriceRecord {
    timestamp: number;
    price: bigint;
}

const gasPriceHistory: GasPriceRecord[] = [];
const MAX_HISTORY_SIZE = 1000;
const HISTORY_RETENTION_HOURS = 24;

// Operation queue for batching
const operationQueue: Operation[] = [];

/**
 * Record gas price for historical analysis
 */
export function recordGasPrice(price: bigint): void {
    gasPriceHistory.push({
        timestamp: Date.now(),
        price,
    });

    // Cleanup old records
    const cutoffTime = Date.now() - HISTORY_RETENTION_HOURS * 60 * 60 * 1000;
    const validHistory = gasPriceHistory.filter(record => record.timestamp >= cutoffTime);
    gasPriceHistory.length = 0;
    gasPriceHistory.push(...validHistory);

    // Keep size manageable
    if (gasPriceHistory.length > MAX_HISTORY_SIZE) {
        gasPriceHistory.shift();
    }
}

/**
 * Predict gas price for future time
 */
export async function predictGasPrice(hoursAhead: number): Promise<bigint> {
    if (gasPriceHistory.length < 10) {
        // Not enough data, return current average
        return getAverageGasPrice();
    }

    // Simple prediction: use average of same time period from historical data
    const now = Date.now();
    const targetHour = new Date(now + hoursAhead * 60 * 60 * 1000).getHours();

    // Get prices from same hour in past days
    const relevantPrices = gasPriceHistory.filter(record => {
        const recordHour = new Date(record.timestamp).getHours();
        return recordHour === targetHour;
    });

    if (relevantPrices.length === 0) {
        return getAverageGasPrice();
    }

    // Calculate average
    const sum = relevantPrices.reduce((acc, record) => acc + record.price, 0n);
    return sum / BigInt(relevantPrices.length);
}

/**
 * Get average gas price from history
 */
function getAverageGasPrice(): bigint {
    if (gasPriceHistory.length === 0) {
        return ethers.parseUnits('50', 'gwei'); // Default fallback
    }

    const sum = gasPriceHistory.reduce((acc, record) => acc + record.price, 0n);
    return sum / BigInt(gasPriceHistory.length);
}

/**
 * Get minimum gas price from recent history
 */
function getMinGasPrice(hoursBack: number = 1): bigint {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    const recentPrices = gasPriceHistory.filter(record => record.timestamp >= cutoffTime);

    if (recentPrices.length === 0) {
        return ethers.parseUnits('50', 'gwei');
    }

    return recentPrices.reduce((min, record) =>
        record.price < min ? record.price : min,
        recentPrices[0].price
    );
}

/**
 * Determine if operation should be delayed for better gas prices
 */
export async function shouldDelayOperation(
    operation: Operation,
    currentGasPrice: bigint
): Promise<boolean> {
    // Never delay immediate operations
    if (operation.urgency === 'immediate') {
        return false;
    }

    // Check if there's a deadline
    if (operation.deadline && operation.deadline < Date.now() + 60 * 60 * 1000) {
        // Less than 1 hour to deadline, don't delay
        return false;
    }

    // Get average and minimum gas prices
    const avgGasPrice = getAverageGasPrice();
    const minGasPrice = getMinGasPrice(6); // Last 6 hours

    // Delay if current price is significantly higher than average
    const threshold = operation.urgency === 'low' ? 1.5 : 1.2;
    if (currentGasPrice > avgGasPrice * BigInt(Math.floor(threshold * 100)) / 100n) {
        console.log(`⏳ Delaying ${operation.type} - gas price ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei > ${ethers.formatUnits(avgGasPrice, 'gwei')} gwei avg`);
        return true;
    }

    // Delay if we're far from the minimum
    if (currentGasPrice > minGasPrice * 2n && operation.urgency === 'low') {
        console.log(`⏳ Delaying ${operation.type} - waiting for lower gas prices`);
        return true;
    }

    return false;
}

/**
 * Batch compatible operations together
 */
export function batchOperations(operations: Operation[]): Operation[] {
    if (operations.length <= 1) {
        return operations;
    }

    // Group operations by type for batching
    const grouped = new Map<string, Operation[]>();

    for (const op of operations) {
        const existing = grouped.get(op.type) || [];
        existing.push(op);
        grouped.set(op.type, existing);
    }

    const batched: Operation[] = [];

    // Create batched operations
    for (const [type, ops] of grouped.entries()) {
        if (ops.length === 1) {
            batched.push(ops[0]);
        } else {
            // Create a batch operation
            batched.push({
                id: `batch_${type}_${Date.now()}`,
                type: `batch_${type}`,
                params: {
                    operations: ops.map(op => op.params),
                },
                urgency: ops.reduce((min, op) =>
                    getUrgencyPriority(op.urgency) < getUrgencyPriority(min) ? op.urgency : min,
                    ops[0].urgency
                ),
                estimatedGas: ops.reduce((sum, op) => sum + op.estimatedGas, 0n) * 80n / 100n, // 20% gas savings from batching
                createdAt: Date.now(),
            });
        }
    }

    const gasSavings = operations.reduce((sum, op) => sum + op.estimatedGas, 0n) -
        batched.reduce((sum, op) => sum + op.estimatedGas, 0n);

    if (gasSavings > 0n) {
        console.log(`💰 Batching ${operations.length} operations → ${batched.length} batches (${ethers.formatUnits(gasSavings, 'gwei')} gwei saved)`);
    }

    return batched;
}

/**
 * Get urgency priority (lower is more urgent)
 */
function getUrgencyPriority(urgency: Urgency): number {
    switch (urgency) {
        case 'immediate': return 0;
        case 'high': return 1;
        case 'normal': return 2;
        case 'low': return 3;
        default: return 2;
    }
}

/**
 * Select gas strategy based on urgency
 */
export function selectGasStrategy(urgency: Urgency): GasStrategy {
    switch (urgency) {
        case 'immediate':
        case 'high':
            return 'aggressive';
        case 'normal':
            return 'normal';
        case 'low':
            return 'patient';
        default:
            return 'normal';
    }
}

/**
 * Calculate optimal gas price for strategy
 */
export async function calculateOptimalGasPrice(
    strategy: GasStrategy,
    currentGasPrice: bigint
): Promise<bigint> {
    const avgGasPrice = getAverageGasPrice();

    switch (strategy) {
        case 'aggressive':
            // Pay 20% above current to ensure fast execution
            return currentGasPrice * 120n / 100n;

        case 'normal':
            // Use current price or average, whichever is lower
            return currentGasPrice < avgGasPrice ? currentGasPrice : avgGasPrice;

        case 'patient':
            // Wait for below-average prices
            const minPrice = getMinGasPrice(6);
            return minPrice < avgGasPrice ? minPrice : avgGasPrice * 80n / 100n;

        default:
            return currentGasPrice;
    }
}

/**
 * Add operation to queue
 */
export function queueOperation(operation: Operation): void {
    operationQueue.push(operation);
    console.log(`📋 Queued operation: ${operation.type} (urgency: ${operation.urgency})`);
}

/**
 * Get operations ready for execution
 */
export async function getReadyOperations(
    currentGasPrice: bigint,
    maxOperations: number = 10
): Promise<Operation[]> {
    const ready: Operation[] = [];

    // Sort by urgency and creation time
    const sorted = [...operationQueue].sort((a, b) => {
        const urgencyDiff = getUrgencyPriority(a.urgency) - getUrgencyPriority(b.urgency);
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.createdAt - b.createdAt;
    });

    for (const op of sorted) {
        if (ready.length >= maxOperations) break;

        // Check if operation should be delayed
        const shouldDelay = await shouldDelayOperation(op, currentGasPrice);

        if (!shouldDelay || op.urgency === 'immediate') {
            ready.push(op);
        }
    }

    // Remove ready operations from queue
    for (const op of ready) {
        const index = operationQueue.indexOf(op);
        if (index > -1) {
            operationQueue.splice(index, 1);
        }
    }

    return ready;
}

/**
 * Calculate break-even point for delaying operation
 */
export function calculateBreakEven(
    operation: Operation,
    currentGasPrice: bigint,
    delayHours: number
): { worthDelaying: boolean; potentialSavings: bigint } {
    const avgGasPrice = getAverageGasPrice();
    const currentCost = operation.estimatedGas * currentGasPrice;
    const avgCost = operation.estimatedGas * avgGasPrice;
    const potentialSavings = currentCost > avgCost ? currentCost - avgCost : 0n;

    // Simple heuristic: worth delaying if savings > 10% and delay < 6 hours
    const worthDelaying = potentialSavings > currentCost / 10n && delayHours <= 6;

    return { worthDelaying, potentialSavings };
}

/**
 * Optimize Gas Action
 */
export const optimizeGasAction: Action = {
    name: 'OPTIMIZE_GAS',
    description: 'Optimize gas costs through batching, timing, and strategy selection',
    similes: ['BATCH_OPERATIONS', 'OPTIMIZE_COSTS', 'REDUCE_GAS'],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        // Always valid - gas optimization is always beneficial
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            console.log('⚡ Running gas optimization engine...');

            const provider = new ethers.JsonRpcProvider(
                process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
            );

            // Get current gas price
            const currentGasPrice = await x402Utils.getCurrentGasPrice(provider);
            recordGasPrice(currentGasPrice);

            // Get operations ready for execution
            const readyOps = await getReadyOperations(currentGasPrice);

            if (readyOps.length === 0) {
                console.log('📭 No operations ready for execution');
                if (callback) {
                    callback({
                        text: 'No operations ready for execution at current gas prices',
                        content: {
                            success: true,
                            queuedOperations: operationQueue.length,
                            currentGasPrice: ethers.formatUnits(currentGasPrice, 'gwei') + ' gwei',
                        },
                    });
                }
                return true;
            }

            // Batch compatible operations
            const batched = batchOperations(readyOps);

            // Calculate gas savings
            const originalGas = readyOps.reduce((sum, op) => sum + op.estimatedGas, 0n);
            const optimizedGas = batched.reduce((sum, op) => sum + op.estimatedGas, 0n);
            const gasSavings = originalGas - optimizedGas;
            const costSavings = gasSavings * currentGasPrice;

            console.log(`✅ Gas optimization complete:`);
            console.log(`   Operations: ${readyOps.length} → ${batched.length} batches`);
            console.log(`   Gas savings: ${ethers.formatUnits(gasSavings, 'gwei')} gwei`);
            console.log(`   Cost savings: ${ethers.formatEther(costSavings)} MEZO`);

            if (callback) {
                callback({
                    text: `Optimized ${readyOps.length} operations into ${batched.length} batches, saving ${ethers.formatEther(costSavings)} MEZO`,
                    content: {
                        success: true,
                        originalOperations: readyOps.length,
                        batchedOperations: batched.length,
                        gasSavings: ethers.formatUnits(gasSavings, 'gwei') + ' gwei',
                        costSavings: ethers.formatEther(costSavings) + ' MEZO',
                        currentGasPrice: ethers.formatUnits(currentGasPrice, 'gwei') + ' gwei',
                        queuedOperations: operationQueue.length,
                    },
                });
            }

            return true;
        } catch (error) {
            console.error('Error in gas optimization:', error);
            if (callback) {
                callback({
                    text: `Gas optimization failed: ${error instanceof Error ? error.message : String(error)}`,
                    content: { success: false, error: String(error) },
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: '{{user1}}',
                content: { text: 'Optimize gas costs for pending operations' },
            },
            {
                user: '{{agent}}',
                content: {
                    text: 'Optimized 5 operations into 2 batches, saving 0.002 MEZO',
                    action: 'OPTIMIZE_GAS',
                },
            },
        ],
    ],
};

/**
 * Exported utilities
 */
export const gasOptimizationUtils = {
    recordGasPrice,
    predictGasPrice,
    shouldDelayOperation,
    batchOperations,
    selectGasStrategy,
    calculateOptimalGasPrice,
    queueOperation,
    getReadyOperations,
    calculateBreakEven,
};
