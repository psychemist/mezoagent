/**
 * Event Listener
 *
 * Monitors blockchain events and provides real-time updates.
 * Supports filtering by contract addresses, event signatures, and block ranges.
 */

import type { MezoRpcClient } from './rpc-client';

export interface EventFilter {
    address?: string | string[];
    topics?: (string | string[] | null)[];
    fromBlock?: bigint | 'latest' | 'earliest';
    toBlock?: bigint | 'latest' | 'earliest';
}

export interface LogEvent {
    address: string;
    topics: string[];
    data: string;
    blockNumber: bigint;
    blockHash: string;
    transactionHash: string;
    transactionIndex: number;
    logIndex: number;
    removed?: boolean;
}

export interface EventListenerOptions {
    pollInterval?: number;
    confirmations?: number;
    onError?: (error: Error) => void;
}

export type EventCallback = (event: LogEvent) => void | Promise<void>;

export class EventListener {
  private rpcClient: MezoRpcClient;
  private filters: Map<string, { filter: EventFilter; callback: EventCallback }> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private lastBlockNumber: bigint = 0n;
  private options: Required<EventListenerOptions>;

  constructor(
    rpcClient: MezoRpcClient,
    options: EventListenerOptions = {}
  ) {
    this.rpcClient = rpcClient;
    this.options = {
      pollInterval: options.pollInterval ?? 5000,
      confirmations: options.confirmations ?? 1,
      onError: options.onError ?? ((error) => console.error('EventListener error:', error)),
    };
  }

  /**
     * Subscribe to events matching a filter
     */
  subscribe(filterId: string, filter: EventFilter, callback: EventCallback): void {
    this.filters.set(filterId, { filter, callback });

    // Start polling if not already started
    if (!this.pollingInterval) {
      this.startPolling();
    }
  }

  /**
     * Unsubscribe from events
     */
  unsubscribe(filterId: string): void {
    this.filters.delete(filterId);

    // Stop polling if no filters remain
    if (this.filters.size === 0) {
      this.stopPolling();
    }
  }

  /**
     * Get all events matching a filter (one-time query)
     */
  async getEvents(filter: EventFilter): Promise<LogEvent[]> {
    try {
      const logs = await this.rpcClient.getLogs({
        fromBlock: filter.fromBlock,
        toBlock: filter.toBlock,
        address: filter.address,
        topics: filter.topics,
      });

      return logs.map((log: any) => ({
        address: log.address,
        topics: log.topics || [],
        data: log.data,
        blockNumber: BigInt(log.blockNumber),
        blockHash: log.blockHash,
        transactionHash: log.transactionHash,
        transactionIndex: parseInt(log.transactionIndex, 16),
        logIndex: parseInt(log.logIndex, 16),
        removed: log.removed || false,
      }));
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
     * Start polling for new events
     */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollEvents();
      } catch (error) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }, this.options.pollInterval);
  }

  /**
     * Stop polling for events
     */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
     * Poll for new events
     */
  private async pollEvents(): Promise<void> {
    try {
      const currentBlock = await this.rpcClient.getBlockNumber();

      // Only process new blocks
      if (currentBlock <= this.lastBlockNumber) {
        return;
      }

      // Process each filter
      for (const [filterId, { filter, callback }] of this.filters.entries()) {
        try {
          // Get events from last processed block to current block
          const fromBlock = this.lastBlockNumber > 0n
            ? this.lastBlockNumber + 1n
            : currentBlock - BigInt(this.options.confirmations);

          const events = await this.getEvents({
            ...filter,
            fromBlock,
            toBlock: currentBlock - BigInt(this.options.confirmations - 1),
          });

          // Call callback for each event
          for (const event of events) {
            try {
              await callback(event);
            } catch (error) {
              this.options.onError(
                error instanceof Error
                  ? error
                  : new Error(`Callback error for filter ${filterId}: ${String(error)}`)
              );
            }
          }
        } catch (error) {
          this.options.onError(
            error instanceof Error
              ? error
              : new Error(`Error processing filter ${filterId}: ${String(error)}`)
          );
        }
      }

      this.lastBlockNumber = currentBlock - BigInt(this.options.confirmations - 1);
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
     * Get the last processed block number
     */
  getLastBlockNumber(): bigint {
    return this.lastBlockNumber;
  }

  /**
     * Reset the last processed block number
     */
  reset(): void {
    this.lastBlockNumber = 0n;
  }

  /**
     * Stop the event listener and clean up
     */
  destroy(): void {
    this.stopPolling();
    this.filters.clear();
    this.lastBlockNumber = 0n;
  }
}

/**
 * Helper function to create event filters for common contract events
 */
export const EventFilters = {
  /**
     * Filter for Transfer events (ERC-20)
     */
  transfer: (tokenAddress: string, from?: string, to?: string): EventFilter => {
    // Transfer(address indexed from, address indexed to, uint256 value)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const topics: (string | null)[] = [transferTopic];

    if (from) {
      topics.push(from.toLowerCase());
    } else {
      topics.push(null);
    }

    if (to) {
      topics.push(to.toLowerCase());
    } else {
      topics.push(null);
    }

    return {
      address: tokenAddress,
      topics,
    };
  },

  /**
     * Filter for Swap events (Tigris DEX)
     */
  swap: (dexAddress: string): EventFilter => {
    // Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)
    const swapTopic = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

    return {
      address: dexAddress,
      topics: [swapTopic],
    };
  },

  /**
     * Filter for Deposit events (Upshift Vault)
     */
  deposit: (vaultAddress: string, user?: string): EventFilter => {
    // Deposit(address indexed user, uint256 amount)
    const depositTopic = '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7';
    const topics: (string | null)[] = [depositTopic];

    if (user) {
      topics.push(user.toLowerCase());
    } else {
      topics.push(null);
    }

    return {
      address: vaultAddress,
      topics,
    };
  },

  /**
     * Filter for Withdraw events (Upshift Vault)
     */
  withdraw: (vaultAddress: string, user?: string): EventFilter => {
    // Withdraw(address indexed user, uint256 amount)
    const withdrawTopic = '0xfb4e863b0c9e61112c0e4c8c8e5c5e5c5e5c5e5c5e5c5e5c5e5c5e5c5e5c5e5';
    const topics: (string | null)[] = [withdrawTopic];

    if (user) {
      topics.push(user.toLowerCase());
    } else {
      topics.push(null);
    }

    return {
      address: vaultAddress,
      topics,
    };
  },
};

