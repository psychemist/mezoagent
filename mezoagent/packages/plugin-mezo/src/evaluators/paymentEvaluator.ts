/**
 * Payment Feasibility Evaluator
 * Validates payment feasibility before executing operations
 */

import { type Evaluator, type IAgentRuntime, type Memory, type State } from '@elizaos/core';
import { ethers } from 'ethers';
import { x402Utils } from '../providers/x402Provider';

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

// Circuit breaker state
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
let circuitBreakerTripped = false;
let lastResetAttempt = 0;
const CIRCUIT_BREAKER_RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
interface RateLimitWindow {
    startTime: number;
    operationCount: number;
}

const rateLimitWindow: RateLimitWindow = {
  startTime: Date.now(),
  operationCount: 0,
};

/**
 * Check if circuit breaker should be reset
 */
function checkCircuitBreakerReset(): void {
  const now = Date.now();
  if (circuitBreakerTripped && (now - lastResetAttempt) >= CIRCUIT_BREAKER_RESET_INTERVAL) {
    console.log(' Attempting to reset circuit breaker...');
    circuitBreakerTripped = false;
    consecutiveFailures = 0;
    lastResetAttempt = now;
  }
}

/**
 * Record operation result for circuit breaker
 */
export function recordOperationResult(success: boolean): void {
  if (success) {
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(` Circuit breaker tripped after ${consecutiveFailures} consecutive failures`);
      circuitBreakerTripped = true;
      lastResetAttempt = Date.now();
    }
  }
}

/**
 * Check rate limits
 */
function checkRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Reset window if it's been more than an hour
  if (now - rateLimitWindow.startTime >= oneHour) {
    rateLimitWindow.startTime = now;
    rateLimitWindow.operationCount = 0;
  }

  // Check if we've exceeded the limit
  if (rateLimitWindow.operationCount >= DEFAULT_CONFIG.limits.maxOperationsPerHour) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${rateLimitWindow.operationCount}/${DEFAULT_CONFIG.limits.maxOperationsPerHour} operations per hour`,
    };
  }

  return { allowed: true };
}

/**
 * Increment rate limit counter
 */
export function incrementRateLimit(): void {
  rateLimitWindow.operationCount++;
}

/**
 * Validate payment feasibility
 */
async function validatePaymentFeasibility(
  _runtime: IAgentRuntime,
  operationType: string,
  operationParams: any
): Promise<{ valid: boolean; reason: string; details?: any }> {
  try {
    // Check circuit breaker
    checkCircuitBreakerReset();
    if (circuitBreakerTripped) {
      return {
        valid: false,
        reason: `Circuit breaker is tripped. System halted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Will retry in ${Math.ceil((CIRCUIT_BREAKER_RESET_INTERVAL - (Date.now() - lastResetAttempt)) / 1000)}s`,
      };
    }

    // Check rate limits
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      return {
        valid: false,
        reason: rateLimitCheck.reason || 'Rate limit exceeded',
      };
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.MEZO_RPC_URL || 'https://rpc.mezo.org'
    );

    // Estimate operation cost
    const gasEstimate = await x402Utils.estimateOperationGas(
      provider,
      operationType,
      operationParams,
      DEFAULT_CONFIG
    );

    // Check if operation cost exceeds maximum
    if (gasEstimate.totalCost > DEFAULT_CONFIG.limits.maxOperationCost) {
      return {
        valid: false,
        reason: `Operation cost (${ethers.formatEther(gasEstimate.totalCost)} MEZO) exceeds maximum allowed (${ethers.formatEther(DEFAULT_CONFIG.limits.maxOperationCost)} MEZO)`,
        details: {
          estimatedCost: gasEstimate.totalCost.toString(),
          maxAllowed: DEFAULT_CONFIG.limits.maxOperationCost.toString(),
        },
      };
    }

    // Get treasury state
    const treasuryState = await x402Utils.getTreasuryState(provider, DEFAULT_CONFIG);

    // Check affordability
    const affordability = await x402Utils.checkAffordability(
      treasuryState,
      gasEstimate.totalCost,
      DEFAULT_CONFIG
    );

    if (!affordability.canAfford) {
      return {
        valid: false,
        reason: affordability.reason,
        details: {
          currentBalance: affordability.currentBalance.toString(),
          requiredAmount: affordability.requiredAmount.toString(),
          shortfall: affordability.shortfall?.toString(),
          suggestedAction: affordability.suggestedAction,
        },
      };
    }

    // Check gas price
    const currentGasPrice = await x402Utils.getCurrentGasPrice(provider);
    if (currentGasPrice > DEFAULT_CONFIG.gas.maxGasPrice) {
      return {
        valid: false,
        reason: `Gas price too high: ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei (max: ${ethers.formatUnits(DEFAULT_CONFIG.gas.maxGasPrice, 'gwei')} gwei). Consider waiting for lower gas prices.`,
        details: {
          currentGasPrice: currentGasPrice.toString(),
          maxGasPrice: DEFAULT_CONFIG.gas.maxGasPrice.toString(),
        },
      };
    }

    // Check treasury health post-operation
    const primaryBalance = treasuryState.balances['MEZO'] || treasuryState.balances['NATIVE'] || 0n;
    const balanceAfterOperation = primaryBalance - gasEstimate.totalCost;

    if (balanceAfterOperation < DEFAULT_CONFIG.treasury.criticalThreshold) {
      return {
        valid: false,
        reason: `Operation would reduce treasury below critical threshold. Balance after: ${ethers.formatEther(balanceAfterOperation)} MEZO, Critical threshold: ${ethers.formatEther(DEFAULT_CONFIG.treasury.criticalThreshold)} MEZO`,
        details: {
          balanceAfter: balanceAfterOperation.toString(),
          criticalThreshold: DEFAULT_CONFIG.treasury.criticalThreshold.toString(),
        },
      };
    }

    // All checks passed
    return {
      valid: true,
      reason: 'Payment feasibility validated successfully',
      details: {
        estimatedCost: gasEstimate.totalCost.toString(),
        currentBalance: primaryBalance.toString(),
        balanceAfter: balanceAfterOperation.toString(),
        gasPrice: currentGasPrice.toString(),
      },
    };
  } catch (error) {
    console.error('Error validating payment feasibility:', error);
    return {
      valid: false,
      reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Payment Feasibility Evaluator
 */
export const paymentEvaluator: Evaluator = {
  name: 'PAYMENT_FEASIBILITY',
  description: 'Evaluates whether an operation is financially feasible before execution',
  similes: ['CAN_AFFORD', 'PAYMENT_CHECK', 'COST_VALIDATION'],
  validate: async (_runtime: IAgentRuntime, _message: Memory, state?: State) => {
    // Extract operation type from message or state
    const operationType = (state?.operationType as string) || 'unknown';
    const operationParams = state?.operationParams || {};

    const result = await validatePaymentFeasibility(_runtime, operationType, operationParams);

    return result.valid;
  },
  handler: async (_runtime: IAgentRuntime, _message: Memory, state?: State) => {
    const operationType = (state?.operationType as string) || 'unknown';
    const operationParams = state?.operationParams || {};

    const result = await validatePaymentFeasibility(_runtime, operationType, operationParams);

    if (result.valid) {
      // Increment rate limit counter
      incrementRateLimit();
    }

    return {
      text: result.reason,
      values: {
        valid: result.valid,
        operationType,
      },
      data: result.details,
      success: result.valid,
    };
  },
  examples: [
    {
      prompt: 'User wants to execute a swap',
      messages: [
        {
          name: '{{name1}}',
          content: { text: 'Swap 1 MEZO for USDC' }
        }
      ],
      outcome: 'Evaluator checks if treasury can afford the swap and gas costs'
    }
  ]
};

/**
 * Helper function to manually validate an operation
 */
export async function canAffordOperation(
  runtime: IAgentRuntime,
  operationType: string,
  operationParams: any
): Promise<{ canAfford: boolean; reason: string; details?: any }> {
  const result = await validatePaymentFeasibility(runtime, operationType, operationParams);
  return {
    canAfford: result.valid,
    reason: result.reason,
    details: result.details,
  };
}
