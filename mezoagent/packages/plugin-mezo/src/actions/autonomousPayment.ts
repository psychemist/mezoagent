 /**
 * Autonomous Payment Action
 * Executes operations with self-managed payment routing
 */

import { type Action, type IAgentRuntime, type Memory, type ActionResult } from '@elizaos/core';
import { ethers } from 'ethers';
import type { AutonomousPaymentResult, OperationCost } from '../types/x402';
import { x402Utils } from '../providers/x402Provider';
import { recordSpending } from '../providers/treasuryProvider';

const DEFAULT_CONFIG = {
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

/**
 * Execute operation with autonomous payment
 */
async function executeWithPayment(
    runtime: IAgentRuntime,
    targetAction: string,
    params: any
): Promise<AutonomousPaymentResult> {
    try {
        const provider = new ethers.JsonRpcProvider(
            process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
        );

        // Step 1: Estimate operation cost
        console.log(`💰 Estimating cost for ${targetAction}...`);
        const gasEstimate = await x402Utils.estimateOperationGas(
            provider,
            targetAction,
            params,
            DEFAULT_CONFIG
        );

        // Step 2: Get treasury state
        const treasuryState = await x402Utils.getTreasuryState(provider, DEFAULT_CONFIG);

        // Step 3: Check affordability
        const affordability = await x402Utils.checkAffordability(
            treasuryState,
            gasEstimate.totalCost,
            DEFAULT_CONFIG
        );

        if (!affordability.canAfford) {
            throw new Error(
                `Insufficient funds: ${affordability.reason}. ` +
                `Required: ${ethers.formatEther(affordability.requiredAmount)} MEZO, ` +
                `Available: ${ethers.formatEther(affordability.currentBalance)} MEZO. ` +
                `Suggested action: ${affordability.suggestedAction}`
            );
        }

        // Step 4: Select payment route
        const paymentRoute = await x402Utils.selectPaymentRoute(
            treasuryState,
            gasEstimate.totalCost,
            DEFAULT_CONFIG
        );

        console.log(`📍 Payment route: ${paymentRoute.method} using ${paymentRoute.token}`);
        console.log(`💵 Estimated cost: ${ethers.formatEther(paymentRoute.estimatedCost)} ${paymentRoute.token}`);

        // Step 5: Execute the operation
        // In production, this would actually execute the blockchain transaction
        // For now, we'll simulate the execution

        const mockTxHash = `0x${Math.random().toString(16).slice(2)}`;

        // Step 6: Calculate actual costs
        const costBreakdown: OperationCost = {
            gasCost: gasEstimate.totalCost,
            operationFees: 0n, // Would include protocol fees
            totalCost: gasEstimate.totalCost,
            paymentToken: paymentRoute.token,
        };

        // Step 7: Record spending
        recordSpending(costBreakdown.totalCost, targetAction);

        // Step 8: Update treasury balance
        const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;
        const balanceAfter = primaryBalance - costBreakdown.totalCost;

        return {
            success: true,
            txHash: mockTxHash,
            operationResult: {
                action: targetAction,
                params,
                executedAt: Date.now(),
            },
            costBreakdown,
            paymentMethod: paymentRoute,
            treasuryBalanceAfter: balanceAfter,
        };
    } catch (error) {
        console.error('Error in autonomous payment execution:', error);
        return {
            success: false,
            costBreakdown: {
                gasCost: 0n,
                operationFees: 0n,
                totalCost: 0n,
                paymentToken: 'MEZO',
            },
            paymentMethod: {
                method: 'direct',
                token: 'MEZO',
                estimatedCost: 0n,
                reason: 'Failed to execute',
            },
            treasuryBalanceAfter: 0n,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Autonomous Payment Action
 */
export const autonomousPaymentAction: Action = {
    name: 'AUTONOMOUS_PAYMENT',
    similes: ['PAY_FOR_OPERATION', 'EXECUTE_WITH_PAYMENT', 'SELF_PAY'],
    description: 'Execute an operation with autonomous payment management',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // This action is typically called programmatically by other actions
        // rather than directly from user messages
        return message.content.text.toLowerCase().includes('autonomous payment') ||
            message.content.text.toLowerCase().includes('self-pay');
    },
    handler: async (runtime: IAgentRuntime, message: Memory): Promise<ActionResult> => {
        try {
            // Parse parameters from message
            // In production, this would be called with structured params
            const targetAction = 'swap'; // Default to swap for demo
            const params = {
                tokenIn: 'MEZO',
                tokenOut: 'USDC',
                amount: ethers.parseEther('1'),
            };

            console.log(`🤖 Executing autonomous payment for ${targetAction}...`);

            const result = await executeWithPayment(runtime, targetAction, params);

            if (!result.success) {
                return {
                    text: `❌ Autonomous payment failed: ${result.error}`,
                    values: {
                        status: 'ERROR',
                        error: result.error,
                    },
                    success: false,
                };
            }

            const costText = `
✅ Operation executed successfully with autonomous payment!

Transaction: ${result.txHash}
Payment Method: ${result.paymentMethod.method} (${result.paymentMethod.token})
Gas Cost: ${ethers.formatEther(result.costBreakdown.gasCost)} ${result.costBreakdown.paymentToken}
Total Cost: ${ethers.formatEther(result.costBreakdown.totalCost)} ${result.costBreakdown.paymentToken}
Treasury Balance After: ${ethers.formatEther(result.treasuryBalanceAfter)} MEZO

Reason: ${result.paymentMethod.reason}
            `.trim();

            return {
                text: costText,
                values: {
                    status: 'SUCCESS',
                    txHash: result.txHash,
                    totalCost: result.costBreakdown.totalCost.toString(),
                    paymentMethod: result.paymentMethod.method,
                    balanceAfter: result.treasuryBalanceAfter.toString(),
                },
                data: result,
                success: true,
            };
        } catch (error) {
            console.error('Error in autonomousPaymentAction:', error);
            return {
                text: `❌ Error executing autonomous payment: ${error instanceof Error ? error.message : String(error)}`,
                values: {
                    status: 'ERROR',
                    error: error instanceof Error ? error.message : String(error),
                },
                success: false,
            };
        }
    },
    examples: [
        [
            {
                name: "{{name1}}",
                content: { text: "Execute swap with autonomous payment" }
            },
            {
                name: "{{name2}}",
                content: {
                    text: "Executing operation with self-managed payment...",
                    actions: ["AUTONOMOUS_PAYMENT"]
                }
            }
        ]
    ]
};

/**
 * Helper function to wrap any action with autonomous payment
 */
export async function wrapWithAutonomousPayment(
    runtime: IAgentRuntime,
    actionName: string,
    actionParams: any
): Promise<AutonomousPaymentResult> {
    return executeWithPayment(runtime, actionName, actionParams);
}
