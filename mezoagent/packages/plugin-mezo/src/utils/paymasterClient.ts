/**
 * Paymaster Client for Gasless Transactions
 * Handles paymaster communication and sponsorship requests
 */

import { ethers } from 'ethers';
import type {
  UserOperation,
  PaymasterResult,
  PaymasterPolicy,
} from '../types/x402';

const PAYMASTER_ENDPOINT = process.env.MEZO_PAYMASTER_ENDPOINT || 'https://paymaster.mezo.org';
const PAYMASTER_API_KEY = process.env.MEZO_PAYMASTER_API_KEY || '';

// Paymaster addresses (could support multiple)
const PAYMASTER_ADDRESSES = {
  primary: process.env.MEZO_PAYMASTER_ADDRESS || '0x0000000000000000000000000000000000000000',
  backup: process.env.MEZO_PAYMASTER_BACKUP_ADDRESS,
};

// Policy cache
let policyCache: { policy: PaymasterPolicy; timestamp: number } | null = null;
const POLICY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Request sponsorship from paymaster
 */
export async function requestSponsorship(
  userOp: UserOperation
): Promise<PaymasterResult> {
  try {
    console.log('📡 Requesting paymaster sponsorship...');

    // Check if paymaster is configured
    if (PAYMASTER_ADDRESSES.primary === '0x0000000000000000000000000000000000000000') {
      console.warn('Paymaster not configured - falling back to direct payment');
      return {
        paymasterAndData: '0x',
        preVerificationGas: 21000n,
        verificationGasLimit: 100000n,
        callGasLimit: 200000n,
        sponsored: false,
      };
    }

    // Make HTTP request to paymaster service
    const response = await fetch(`${PAYMASTER_ENDPOINT}/api/v1/sponsorship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYMASTER_API_KEY}`,
      },
      body: JSON.stringify({
        userOp: serializeUserOp(userOp),
        chainId: parseInt(process.env.MEZO_CHAIN_ID || '1'),
      }),
    });

    if (!response.ok) {
      throw new Error(`Paymaster request failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse paymaster response
    const paymasterAndData = data.paymasterAndData || '0x';
    const sponsored = paymasterAndData !== '0x';

    return {
      paymasterAndData,
      preVerificationGas: BigInt(data.preVerificationGas || 21000),
      verificationGasLimit: BigInt(data.verificationGasLimit || 100000),
      callGasLimit: BigInt(data.callGasLimit || 200000),
      sponsored,
      paymasterAddress: sponsored ? PAYMASTER_ADDRESSES.primary : undefined,
    };
  } catch (error) {
    console.error('Error requesting paymaster sponsorship:', error);

    // Return unsponsored result on error
    return {
      paymasterAndData: '0x',
      preVerificationGas: 21000n,
      verificationGasLimit: 100000n,
      callGasLimit: 200000n,
      sponsored: false,
    };
  }
}

/**
 * Verify sponsorship is valid
 */
export async function verifySponsorship(userOp: UserOperation): Promise<boolean> {
  try {
    if (!userOp.paymasterAndData || userOp.paymasterAndData === '0x') {
      return false;
    }

    // Extract paymaster address from paymasterAndData
    const paymasterAddress = `0x${userOp.paymasterAndData.slice(2, 42)}`;

    // Verify it matches a known paymaster
    const isKnownPaymaster = Object.values(PAYMASTER_ADDRESSES).includes(paymasterAddress);

    return isKnownPaymaster;
  } catch (error) {
    console.error('Error verifying sponsorship:', error);
    return false;
  }
}

/**
 * Get paymaster policy
 */
export async function getPaymasterPolicy(): Promise<PaymasterPolicy> {
  const now = Date.now();

  // Return cached policy if still valid
  if (policyCache && (now - policyCache.timestamp) < POLICY_CACHE_DURATION) {
    return policyCache.policy;
  }

  try {
    // Fetch policy from paymaster service
    const response = await fetch(`${PAYMASTER_ENDPOINT}/api/v1/policy`, {
      headers: {
        'Authorization': `Bearer ${PAYMASTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch paymaster policy: ${response.statusText}`);
    }

    const data = await response.json();

    const policy: PaymasterPolicy = {
      maxGasSponsored: BigInt(data.maxGasSponsored || ethers.parseEther('0.1').toString()),
      allowedOperations: data.allowedOperations || ['swap', 'deposit', 'withdraw'],
      rateLimit: {
        maxOperationsPerHour: data.rateLimit?.maxOperationsPerHour || 50,
        maxDailySpend: BigInt(data.rateLimit?.maxDailySpend || ethers.parseEther('10').toString()),
      },
      tokenPayment: data.tokenPayment ? {
        token: data.tokenPayment.token,
        exchangeRate: BigInt(data.tokenPayment.exchangeRate),
      } : undefined,
    };

    policyCache = { policy, timestamp: now };
    return policy;
  } catch (error) {
    console.error('Error fetching paymaster policy:', error);

    // Return default policy
    const defaultPolicy: PaymasterPolicy = {
      maxGasSponsored: ethers.parseEther('0.1'),
      allowedOperations: ['swap', 'deposit', 'withdraw'],
      rateLimit: {
        maxOperationsPerHour: 50,
        maxDailySpend: ethers.parseEther('10'),
      },
    };

    return defaultPolicy;
  }
}

/**
 * Select best paymaster from multiple options
 */
export async function selectBestPaymaster(
  userOps: UserOperation[]
): Promise<string> {
  try {
    // Calculate total gas needed
    const totalGas = userOps.reduce((sum, op) => {
      return sum + op.callGasLimit + op.verificationGasLimit + op.preVerificationGas;
    }, 0n);

    // Get policy for each paymaster
    const policy = await getPaymasterPolicy();

    // Check if primary paymaster can handle the load
    if (totalGas <= policy.maxGasSponsored) {
      return PAYMASTER_ADDRESSES.primary;
    }

    // Fall back to backup if available
    if (PAYMASTER_ADDRESSES.backup) {
      return PAYMASTER_ADDRESSES.backup;
    }

    // Return primary as default
    return PAYMASTER_ADDRESSES.primary;
  } catch (error) {
    console.error('Error selecting paymaster:', error);
    return PAYMASTER_ADDRESSES.primary;
  }
}

/**
 * Check if operation is eligible for sponsorship
 */
export async function isEligibleForSponsorship(
  operationType: string,
  estimatedGas: bigint
): Promise<boolean> {
  try {
    const policy = await getPaymasterPolicy();

    // Check if operation type is allowed
    if (!policy.allowedOperations.includes(operationType)) {
      return false;
    }

    // Check if gas is within limits
    if (estimatedGas > policy.maxGasSponsored) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking sponsorship eligibility:', error);
    return false;
  }
}

/**
 * Serialize UserOperation for API calls
 */
function serializeUserOp(userOp: UserOperation): any {
  return {
    sender: userOp.sender,
    nonce: `0x${userOp.nonce.toString(16)}`,
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

/**
 * WebSocket connection for real-time sponsorship updates
 */
export class PaymasterWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private endpoint: string = PAYMASTER_ENDPOINT) { }

  connect(): void {
    try {
      const wsEndpoint = this.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
      this.ws = new WebSocket(`${wsEndpoint}/ws`);

      this.ws.onopen = () => {
        console.log('✅ Connected to paymaster WebSocket');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Paymaster WebSocket closed');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error connecting to paymaster WebSocket:', error);
    }
  }

  private handleMessage(data: any): void {
    // Handle real-time updates from paymaster
    if (data.type === 'policy_update') {
      console.log('📋 Paymaster policy updated');
      policyCache = null; // Invalidate cache
    } else if (data.type === 'sponsorship_status') {
      console.log(`💰 Sponsorship status: ${data.status}`);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }
}

/**
 * Compare costs: paymaster vs direct payment
 */
export async function compareCosts(
  userOp: UserOperation,
  gasPrice: bigint
): Promise<{ paymaster: bigint; direct: bigint; savings: bigint; recommended: 'paymaster' | 'direct' }> {
  try {
    // Get paymaster policy
    const policy = await getPaymasterPolicy();

    // Calculate direct payment cost
    const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
    const directCost = totalGas * gasPrice;

    // Calculate paymaster cost (if using token payment)
    let paymasterCost = 0n;
    if (policy.tokenPayment) {
      // Convert gas cost to token amount using exchange rate
      paymasterCost = (totalGas * policy.tokenPayment.exchangeRate) / ethers.parseEther('1');
    }

    const savings = directCost - paymasterCost;
    const recommended = paymasterCost < directCost ? 'paymaster' : 'direct';

    return {
      paymaster: paymasterCost,
      direct: directCost,
      savings,
      recommended,
    };
  } catch (error) {
    console.error('Error comparing costs:', error);

    const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
    const directCost = totalGas * gasPrice;

    return {
      paymaster: 0n,
      direct: directCost,
      savings: 0n,
      recommended: 'direct',
    };
  }
}
