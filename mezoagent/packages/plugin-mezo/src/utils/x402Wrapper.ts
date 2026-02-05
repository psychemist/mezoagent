/**
 * X402 Action Wrapper
 * Helper functions to wrap existing actions with X402 autonomous payment
 */

import { type IAgentRuntime, type Memory, type ActionResult, type State } from '@elizaos/core';
import { paymentEvaluator } from '../evaluators/paymentEvaluator';
import { autonomousPaymentAction } from '../actions/autonomousPayment';
import { autoRefund, recordSpending } from '../providers/treasuryProvider';
import { loadX402Config } from './config';

/**
 * Wrap an action with X402 autonomous payment
 */
export async function wrapWithX402<T extends ActionResult>(
  runtime: IAgentRuntime,
  message: Memory,
  actionName: string,
  actionHandler: () => Promise<T>,
  options?: {
        critical?: boolean;
        estimatedCost?: bigint;
        state?: State;
    }
): Promise<T> {
  try {
    const config = loadX402Config();

    // 1. Check payment feasibility
    const feasibilityState = {
      ...options?.state,
      action: actionName,
      params: message.content,
      critical: options?.critical || false,
    };

    const isFeasible = await paymentEvaluator.validate(
      runtime,
      message,
      feasibilityState
    );

    if (!isFeasible) {
      console.log(`❌ Payment feasibility check failed for ${actionName}`);

      // Try auto-refund if enabled
      if (config.treasury.autoRefundEnabled && !options?.critical) {
        console.log('💰 Attempting auto-refund...');
        const refundResult = await autoRefund(runtime, config);

        if (refundResult.success) {
          console.log(`✅ Auto-refund successful: ${refundResult.amount} from ${refundResult.source}`);

          // Retry feasibility check
          const retryFeasible = await paymentEvaluator.validate(
            runtime,
            message,
            feasibilityState
          );

          if (!retryFeasible) {
            return {
              text: '❌ Operation not feasible even after auto-refund. Please add funds to treasury.',
              values: { status: 'FAILED', reason: 'insufficient_funds' },
              success: false,
            } as T;
          }
        } else {
          return {
            text: `❌ Operation not feasible and auto-refund failed: ${refundResult.error}`,
            values: { status: 'FAILED', reason: 'auto_refund_failed' },
            success: false,
          } as T;
        }
      } else {
        return {
          text: '❌ Operation not feasible. Treasury balance insufficient.',
          values: { status: 'FAILED', reason: 'insufficient_funds' },
          success: false,
        } as T;
      }
    }

    // 2. Execute the action
    console.log(`⚡ Executing ${actionName} with X402 autonomous payment...`);
    const result = await actionHandler();

    // 3. Record result
    if (result.success) {
      // Record spending if cost is known
      if (options?.estimatedCost) {
        recordSpending(options.estimatedCost, actionName);
      }

      console.log(`✅ ${actionName} completed successfully`);
    } else {
      console.log(`❌ ${actionName} failed`);
    }

    return result;
  } catch (error) {
    console.error(`Error in X402 wrapper for ${actionName}:`, error);

    return {
      text: `❌ Error executing ${actionName}: ${error instanceof Error ? error.message : String(error)}`,
      values: { status: 'ERROR', error: String(error) },
      success: false,
    } as T;
  }
}

/**
 * Execute action with autonomous payment (uses autonomousPaymentAction)
 */
export async function executeWithAutonomousPayment(
  runtime: IAgentRuntime,
  message: Memory,
  targetAction: string,
  params: any,
  options?: {
        critical?: boolean;
        usePaymaster?: boolean;
    }
): Promise<ActionResult> {
  const state: State = {
    targetAction,
    params,
    critical: options?.critical,
    usePaymaster: options?.usePaymaster,
  };

  return await autonomousPaymentAction.handler(
    runtime,
    message,
    state,
    {},
    undefined
  );
}

/**
 * Check if action can afford to execute
 */
export async function canAffordAction(
  runtime: IAgentRuntime,
  message: Memory,
  actionName: string,
  estimatedCost?: bigint
): Promise<{ canAfford: boolean; reason: string; details?: any }> {
  const state: State = {
    action: actionName,
    params: message.content,
    estimatedCost: estimatedCost?.toString(),
  };

  const result = await paymentEvaluator.handler(runtime, message, state);

  return {
    canAfford: result.valid || false,
    reason: result.reason || 'Unknown',
    details: result.details,
  };
}

/**
 * Decorator to add X402 to existing action handlers
 */
export function withX402Payment(
  actionName: string,
  options?: {
        critical?: boolean;
        estimateGas?: (params: any) => Promise<bigint>;
    }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalHandler = descriptor.value;

    descriptor.value = async function (
      runtime: IAgentRuntime,
      message: Memory,
      ...args: any[]
    ): Promise<ActionResult> {
      // Estimate cost if function provided
      let estimatedCost: bigint | undefined;
      if (options?.estimateGas) {
        try {
          estimatedCost = await options.estimateGas(message.content);
        } catch (error) {
          console.warn('Failed to estimate gas:', error);
        }
      }

      // Wrap with X402
      return await wrapWithX402(
        runtime,
        message,
        actionName,
        () => originalHandler.apply(this, [runtime, message, ...args]),
        {
          critical: options?.critical,
          estimatedCost,
        }
      );
    };

    return descriptor;
  };
}
