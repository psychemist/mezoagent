/**
 * X402 Self-Autonomous Payment Structure Type Definitions
 * Implements EIP-4337 Account Abstraction patterns for autonomous agent payments
 */

/**
 * Treasury state tracking across multiple tokens
 */
export interface TreasuryState {
    balances: {
        [token: string]: bigint;
    };
    totalValueUSD: number;
    lastUpdated: number;
    burnRate: number; // Tokens spent per day
    runwayDays: number; // Days until funds depleted
}

/**
 * Treasury configuration thresholds
 */
export interface TreasuryConfig {
    minReserve: bigint; // Minimum balance to maintain
    warningThreshold: bigint; // Trigger warning alerts
    criticalThreshold: bigint; // Trigger emergency actions
    autoRefundEnabled: boolean;
    supportedTokens: string[];
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
    gasLimit: bigint;
    gasPrice: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    totalCost: bigint;
}

/**
 * EIP-4337 UserOperation structure
 */
export interface UserOperation {
    sender: string;
    nonce: bigint;
    initCode: string;
    callData: string;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}

/**
 * Parameters for building a UserOperation
 */
export interface UserOpParams {
    sender: string;
    target: string;
    value: bigint;
    data: string;
    usePaymaster?: boolean;
}

/**
 * Paymaster sponsorship result
 */
export interface PaymasterResult {
    paymasterAndData: string;
    preVerificationGas: bigint;
    verificationGasLimit: bigint;
    callGasLimit: bigint;
    sponsored: boolean;
    paymasterAddress?: string;
}

/**
 * Paymaster policy configuration
 */
export interface PaymasterPolicy {
    maxGasSponsored: bigint;
    allowedOperations: string[];
    rateLimit: {
        maxOperationsPerHour: number;
        maxDailySpend: bigint;
    };
    tokenPayment?: {
        token: string;
        exchangeRate: bigint;
    };
}

/**
 * Payment routing decision
 */
export interface PaymentRoute {
    method: 'direct' | 'paymaster' | 'token-swap';
    token: string;
    estimatedCost: bigint;
    reason: string;
}

/**
 * Operation cost breakdown
 */
export interface OperationCost {
    gasCost: bigint;
    operationFees: bigint;
    totalCost: bigint;
    paymentToken: string;
}

/**
 * Treasury health status
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'emergency';

/**
 * Treasury metrics for monitoring
 */
export interface TreasuryMetrics {
    status: HealthStatus;
    currentBalance: bigint;
    burnRate: number;
    runwayDays: number;
    utilizationRate: number; // Percentage of treasury in use
    lastRefund: number;
    totalSpent24h: bigint;
    operationCount24h: number;
}

/**
 * Auto-refund result
 */
export interface RefundResult {
    success: boolean;
    amount: bigint;
    source: 'upshift-yields' | 'external-wallet' | 'credit-line';
    txHash?: string;
    error?: string;
}

/**
 * Yield harvest result
 */
export interface HarvestResult {
    success: boolean;
    harvested: bigint;
    token: string;
    depositedToTreasury: bigint;
    txHash?: string;
    error?: string;
}

/**
 * Gas optimization strategy
 */
export type GasStrategy = 'aggressive' | 'normal' | 'patient';

/**
 * Operation urgency level
 */
export type Urgency = 'immediate' | 'high' | 'normal' | 'low';

/**
 * Operation for batching/queuing
 */
export interface Operation {
    id: string;
    type: string;
    params: any;
    urgency: Urgency;
    estimatedGas: bigint;
    deadline?: number;
    createdAt: number;
}

/**
 * UserOperation validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Payment feasibility check result
 */
export interface FeasibilityResult {
    canAfford: boolean;
    reason: string;
    currentBalance: bigint;
    requiredAmount: bigint;
    shortfall?: bigint;
    suggestedAction?: 'refund' | 'wait' | 'reduce-amount';
}

/**
 * X402 configuration schema
 */
export interface X402Config {
    enabled: boolean;
    treasury: TreasuryConfig;
    gas: {
        maxGasPrice: bigint;
        optimizationEnabled: boolean;
        batchingEnabled: boolean;
        gasMultiplier: number;
        priorityFee: bigint;
    };
    paymaster: {
        enabled: boolean;
        endpoint: string;
        fallbackToDirectPayment: boolean;
        preferredStrategy: 'token-based' | 'whitelist' | 'stake-based';
    };
    limits: {
        maxOperationCost: bigint;
        maxOperationsPerHour: number;
        maxDailySpend: bigint;
    };
    funding: {
        sources: Array<'upshift-yields' | 'external-wallet' | 'credit-line'>;
        autoHarvestEnabled: boolean;
        harvestThreshold: bigint;
        emergencyFundingAddress?: string;
    };
}

/**
 * Autonomous payment execution result
 */
export interface AutonomousPaymentResult {
    success: boolean;
    txHash?: string;
    operationResult?: any;
    costBreakdown: OperationCost;
    paymentMethod: PaymentRoute;
    treasuryBalanceAfter: bigint;
    error?: string;
}
