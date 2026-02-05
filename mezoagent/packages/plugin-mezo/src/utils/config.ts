/**
 * X402 Configuration Helper
 * Loads and validates X402 configuration from environment variables
 */

import { ethers } from 'ethers';
import type { X402Config } from '../types/x402';

/**
 * Load X402 configuration from environment variables
 */
export function loadX402Config(): X402Config {
  return {
    enabled: process.env.X402_ENABLED !== 'false', // Default to true
    treasury: {
      minReserve: process.env.X402_MIN_RESERVE
        ? BigInt(process.env.X402_MIN_RESERVE)
        : ethers.parseEther('10'),
      warningThreshold: process.env.X402_WARNING_THRESHOLD
        ? BigInt(process.env.X402_WARNING_THRESHOLD)
        : ethers.parseEther('20'),
      criticalThreshold: process.env.X402_CRITICAL_THRESHOLD
        ? BigInt(process.env.X402_CRITICAL_THRESHOLD)
        : ethers.parseEther('5'),
      autoRefundEnabled: process.env.X402_AUTO_REFUND_ENABLED !== 'false',
      supportedTokens: process.env.X402_SUPPORTED_TOKENS
        ? process.env.X402_SUPPORTED_TOKENS.split(',')
        : ['MEZO', 'BTC', 'USDC'],
    },
    gas: {
      maxGasPrice: process.env.X402_MAX_GAS_PRICE
        ? BigInt(process.env.X402_MAX_GAS_PRICE)
        : ethers.parseUnits('100', 'gwei'),
      optimizationEnabled: process.env.X402_GAS_OPTIMIZATION_ENABLED !== 'false',
      batchingEnabled: process.env.X402_BATCHING_ENABLED !== 'false',
      gasMultiplier: process.env.X402_GAS_MULTIPLIER
        ? parseFloat(process.env.X402_GAS_MULTIPLIER)
        : 1.2,
      priorityFee: process.env.X402_PRIORITY_FEE
        ? BigInt(process.env.X402_PRIORITY_FEE)
        : ethers.parseUnits('2', 'gwei'),
    },
    paymaster: {
      enabled: process.env.X402_PAYMASTER_ENABLED !== 'false',
      endpoint: process.env.MEZO_PAYMASTER_ENDPOINT || 'https://paymaster.mezo.org',
      fallbackToDirectPayment: process.env.X402_PAYMASTER_FALLBACK !== 'false',
      preferredStrategy: (process.env.X402_PAYMASTER_STRATEGY as 'token-based' | 'whitelist' | 'stake-based') || 'token-based',
    },
    limits: {
      maxOperationCost: process.env.X402_MAX_OPERATION_COST
        ? BigInt(process.env.X402_MAX_OPERATION_COST)
        : ethers.parseEther('1'),
      maxOperationsPerHour: process.env.X402_MAX_OPERATIONS_PER_HOUR
        ? parseInt(process.env.X402_MAX_OPERATIONS_PER_HOUR)
        : 100,
      maxDailySpend: process.env.X402_MAX_DAILY_SPEND
        ? BigInt(process.env.X402_MAX_DAILY_SPEND)
        : ethers.parseEther('50'),
    },
    funding: {
      sources: process.env.X402_FUNDING_SOURCES
        ? process.env.X402_FUNDING_SOURCES.split(',') as Array<'upshift-yields' | 'external-wallet' | 'credit-line'>
        : ['upshift-yields', 'external-wallet'],
      autoHarvestEnabled: process.env.X402_AUTO_HARVEST_ENABLED !== 'false',
      harvestThreshold: process.env.X402_HARVEST_THRESHOLD
        ? BigInt(process.env.X402_HARVEST_THRESHOLD)
        : ethers.parseEther('5'),
      emergencyFundingAddress: process.env.MEZO_EMERGENCY_FUNDING_ADDRESS,
    },
  };
}

/**
 * Validate X402 configuration
 */
export function validateX402Config(config: X402Config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate treasury thresholds
  if (config.treasury.criticalThreshold >= config.treasury.warningThreshold) {
    errors.push('Critical threshold must be less than warning threshold');
  }

  if (config.treasury.minReserve >= config.treasury.criticalThreshold) {
    errors.push('Min reserve must be less than critical threshold');
  }

  // Validate gas configuration
  if (config.gas.gasMultiplier < 1.0) {
    errors.push('Gas multiplier must be >= 1.0');
  }

  if (config.gas.maxGasPrice <= 0n) {
    errors.push('Max gas price must be positive');
  }

  // Validate limits
  if (config.limits.maxOperationsPerHour <= 0) {
    errors.push('Max operations per hour must be positive');
  }

  if (config.limits.maxDailySpend <= 0n) {
    errors.push('Max daily spend must be positive');
  }

  // Validate funding sources
  if (config.funding.sources.length === 0) {
    errors.push('At least one funding source must be configured');
  }

  // Validate paymaster strategy
  const validStrategies = ['token-based', 'whitelist', 'stake-based'];
  if (!validStrategies.includes(config.paymaster.preferredStrategy)) {
    errors.push(`Invalid paymaster strategy: ${config.paymaster.preferredStrategy}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get human decision configurations
 */
export interface HumanDecisions {
    gasSponsorshipStrategy: 'always' | 'hybrid' | 'never';
    riskTolerance: 'conservative' | 'balanced' | 'aggressive';
    emergencyShutdownTriggers: {
        balanceThreshold: bigint;
        failureThreshold: number;
        gasPriceThreshold: bigint;
    };
}

export function loadHumanDecisions(): HumanDecisions {
  const strategy = process.env.X402_GAS_SPONSORSHIP_STRATEGY as 'always' | 'hybrid' | 'never';
  const tolerance = process.env.X402_RISK_TOLERANCE as 'conservative' | 'balanced' | 'aggressive';

  return {
    gasSponsorshipStrategy: strategy || 'hybrid',
    riskTolerance: tolerance || 'balanced',
    emergencyShutdownTriggers: {
      balanceThreshold: process.env.X402_EMERGENCY_BALANCE_THRESHOLD
        ? BigInt(process.env.X402_EMERGENCY_BALANCE_THRESHOLD)
        : ethers.parseEther('1'),
      failureThreshold: process.env.X402_EMERGENCY_FAILURE_THRESHOLD
        ? parseInt(process.env.X402_EMERGENCY_FAILURE_THRESHOLD)
        : 10,
      gasPriceThreshold: process.env.X402_EMERGENCY_GAS_PRICE_THRESHOLD
        ? BigInt(process.env.X402_EMERGENCY_GAS_PRICE_THRESHOLD)
        : ethers.parseUnits('500', 'gwei'),
    },
  };
}

/**
 * Apply risk tolerance to configuration
 */
export function applyRiskTolerance(config: X402Config, tolerance: 'conservative' | 'balanced' | 'aggressive'): X402Config {
  const adjustedConfig = { ...config };

  switch (tolerance) {
    case 'conservative':
      // Larger reserves, stricter limits
      adjustedConfig.treasury.minReserve = adjustedConfig.treasury.minReserve * 2n;
      adjustedConfig.treasury.warningThreshold = adjustedConfig.treasury.warningThreshold * 2n;
      adjustedConfig.limits.maxOperationCost = adjustedConfig.limits.maxOperationCost / 2n;
      adjustedConfig.limits.maxDailySpend = adjustedConfig.limits.maxDailySpend / 2n;
      adjustedConfig.gas.gasMultiplier = 1.5; // More conservative gas pricing
      break;

    case 'aggressive':
      // Smaller reserves, higher limits
      adjustedConfig.treasury.minReserve = adjustedConfig.treasury.minReserve / 2n;
      adjustedConfig.treasury.warningThreshold = adjustedConfig.treasury.warningThreshold / 2n;
      adjustedConfig.limits.maxOperationCost = adjustedConfig.limits.maxOperationCost * 2n;
      adjustedConfig.limits.maxDailySpend = adjustedConfig.limits.maxDailySpend * 2n;
      adjustedConfig.gas.gasMultiplier = 1.1; // More aggressive gas pricing
      break;

    case 'balanced':
    default:
      // Use defaults
      break;
  }

  return adjustedConfig;
}

/**
 * Print configuration summary
 */
export function printConfigSummary(config: X402Config, decisions: HumanDecisions): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('X402 Self-Autonomous Payment System Configuration');
  console.log('='.repeat(60));

  console.log('\n📊 Treasury Configuration:');
  console.log(`  Min Reserve: ${ethers.formatEther(config.treasury.minReserve)} MEZO`);
  console.log(`  Warning Threshold: ${ethers.formatEther(config.treasury.warningThreshold)} MEZO`);
  console.log(`  Critical Threshold: ${ethers.formatEther(config.treasury.criticalThreshold)} MEZO`);
  console.log(`  Auto-Refund: ${config.treasury.autoRefundEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Supported Tokens: ${config.treasury.supportedTokens.join(', ')}`);

  console.log('\n⛽ Gas Configuration:');
  console.log(`  Max Gas Price: ${ethers.formatUnits(config.gas.maxGasPrice, 'gwei')} gwei`);
  console.log(`  Optimization: ${config.gas.optimizationEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Batching: ${config.gas.batchingEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Gas Multiplier: ${config.gas.gasMultiplier}x`);
  console.log(`  Priority Fee: ${ethers.formatUnits(config.gas.priorityFee, 'gwei')} gwei`);

  console.log('\n💳 Paymaster Configuration:');
  console.log(`  Enabled: ${config.paymaster.enabled ? 'YES' : 'NO'}`);
  console.log(`  Endpoint: ${config.paymaster.endpoint}`);
  console.log(`  Fallback to Direct: ${config.paymaster.fallbackToDirectPayment ? 'YES' : 'NO'}`);
  console.log(`  Strategy: ${config.paymaster.preferredStrategy}`);

  console.log('\n🚦 Limits:');
  console.log(`  Max Operation Cost: ${ethers.formatEther(config.limits.maxOperationCost)} MEZO`);
  console.log(`  Max Operations/Hour: ${config.limits.maxOperationsPerHour}`);
  console.log(`  Max Daily Spend: ${ethers.formatEther(config.limits.maxDailySpend)} MEZO`);

  console.log('\n💰 Funding Configuration:');
  console.log(`  Sources: ${config.funding.sources.join(', ')}`);
  console.log(`  Auto-Harvest: ${config.funding.autoHarvestEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Harvest Threshold: ${ethers.formatEther(config.funding.harvestThreshold)} MEZO`);
  if (config.funding.emergencyFundingAddress) {
    console.log(`  Emergency Funding: ${config.funding.emergencyFundingAddress}`);
  }

  console.log('\n🎯 Human Decisions:');
  console.log(`  Gas Sponsorship: ${decisions.gasSponsorshipStrategy.toUpperCase()}`);
  console.log(`  Risk Tolerance: ${decisions.riskTolerance.toUpperCase()}`);
  console.log('  Emergency Shutdown:');
  console.log(`    - Balance < ${ethers.formatEther(decisions.emergencyShutdownTriggers.balanceThreshold)} MEZO`);
  console.log(`    - Failures > ${decisions.emergencyShutdownTriggers.failureThreshold}`);
  console.log(`    - Gas Price > ${ethers.formatUnits(decisions.emergencyShutdownTriggers.gasPriceThreshold, 'gwei')} gwei`);

  console.log(`\n${'='.repeat(60)}\n`);
}

/**
 * Initialize X402 system with configuration
 */
export function initializeX402(): { config: X402Config; decisions: HumanDecisions; valid: boolean; errors: string[] } {
  const config = loadX402Config();
  const decisions = loadHumanDecisions();

  // Apply risk tolerance adjustments
  const adjustedConfig = applyRiskTolerance(config, decisions.riskTolerance);

  // Validate configuration
  const validation = validateX402Config(adjustedConfig);

  if (!validation.valid) {
    console.error('❌ X402 Configuration Validation Failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log('✅ X402 Configuration Valid');
    printConfigSummary(adjustedConfig, decisions);
  }

  return {
    config: adjustedConfig,
    decisions,
    valid: validation.valid,
    errors: validation.errors,
  };
}
