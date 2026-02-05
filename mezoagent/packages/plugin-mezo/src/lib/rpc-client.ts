/**
 * Mezo RPC Client
 *
 * Provides a connection layer to the Mezo blockchain RPC endpoint.
 * Handles connection management, retries, and error handling.
 */

export interface RpcConfig {
    url: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    headers?: Record<string, string>;
}

export interface RpcRequest {
    method: string;
    params?: unknown[];
    id?: number;
    jsonrpc?: '2.0';
}

export interface RpcResponse<T = unknown> {
    jsonrpc: '2.0';
    id: number;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export class MezoRpcClient {
  private config: Required<RpcConfig>;
  private requestId = 0;

  constructor(config: RpcConfig) {
    this.config = {
      url: config.url,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    };

    if (!this.config.url) {
      throw new Error('RPC URL is required');
    }
  }

  /**
     * Makes a JSON-RPC request to the Mezo chain
     */
  async request<T = unknown>(method: string, params?: unknown[]): Promise<T> {
    const request: RpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params: params ?? [],
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.executeRequest<T>(request);

        if (response.error) {
          throw new Error(
            `RPC Error [${response.error.code}]: ${response.error.message}`
          );
        }

        if (response.result === undefined) {
          throw new Error('RPC response missing result');
        }

        return response.result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('RPC request failed');
  }

  /**
     * Executes a single RPC request
     */
  private async executeRequest<T>(request: RpcRequest): Promise<RpcResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: this.config.headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RpcResponse<T> = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`RPC request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }

  /**
     * Batch request - sends multiple RPC requests in a single HTTP call
     */
  async batch<T extends unknown[]>(
    requests: Array<{ method: string; params?: unknown[] }>
  ): Promise<T> {
    const batchRequest: RpcRequest[] = requests.map((req, index) => ({
      jsonrpc: '2.0',
      id: ++this.requestId + index,
      method: req.method,
      params: req.params ?? [],
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: this.config.headers,
        body: JSON.stringify(batchRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RpcResponse<T[number]>[] = await response.json();

      // Sort by ID to maintain order
      data.sort((a, b) => a.id - b.id);

      return data.map((item) => {
        if (item.error) {
          throw new Error(
            `RPC Error [${item.error.code}]: ${item.error.message}`
          );
        }
        return item.result as T[number];
      }) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`RPC batch request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }

  /**
     * Get the current block number
     */
  async getBlockNumber(): Promise<bigint> {
    const result = await this.request<string>('eth_blockNumber');
    return BigInt(result);
  }

  /**
     * Get block by number
     */
  async getBlock(blockNumber: bigint | 'latest' | 'pending', fullTransactions = false) {
    const blockNum = typeof blockNumber === 'bigint'
      ? `0x${blockNumber.toString(16)}`
      : blockNumber;

    return this.request('eth_getBlockByNumber', [blockNum, fullTransactions]);
  }

  /**
     * Get transaction receipt
     */
  async getTransactionReceipt(txHash: string) {
    return this.request('eth_getTransactionReceipt', [txHash]);
  }

  /**
     * Get transaction by hash
     */
  async getTransaction(txHash: string) {
    return this.request('eth_getTransactionByHash', [txHash]);
  }

  /**
     * Get balance of an address
     */
  async getBalance(address: string, blockNumber: bigint | 'latest' = 'latest'): Promise<bigint> {
    const blockNum = typeof blockNumber === 'bigint'
      ? `0x${blockNumber.toString(16)}`
      : blockNumber;

    const result = await this.request<string>('eth_getBalance', [address, blockNum]);
    return BigInt(result);
  }

  /**
     * Get transaction count (nonce) for an address
     */
  async getTransactionCount(address: string, blockNumber: bigint | 'latest' = 'latest'): Promise<number> {
    const blockNum = typeof blockNumber === 'bigint'
      ? `0x${blockNumber.toString(16)}`
      : blockNumber;

    const result = await this.request<string>('eth_getTransactionCount', [address, blockNum]);
    return parseInt(result, 16);
  }

  /**
     * Estimate gas for a transaction
     */
  async estimateGas(transaction: {
        from?: string;
        to?: string;
        value?: string;
        data?: string;
        gas?: string;
        gasPrice?: string;
    }): Promise<bigint> {
    const result = await this.request<string>('eth_estimateGas', [transaction]);
    return BigInt(result);
  }

  /**
     * Send raw transaction
     */
  async sendRawTransaction(signedTx: string): Promise<string> {
    return this.request<string>('eth_sendRawTransaction', [signedTx]);
  }

  /**
     * Call a contract method without creating a transaction
     */
  async call(transaction: {
        to: string;
        data: string;
        from?: string;
        value?: string;
        gas?: string;
        gasPrice?: string;
    }, blockNumber: bigint | 'latest' = 'latest'): Promise<string> {
    const blockNum = typeof blockNumber === 'bigint'
      ? `0x${blockNumber.toString(16)}`
      : blockNumber;

    return this.request<string>('eth_call', [transaction, blockNum]);
  }

  /**
     * Get logs for a filter
     */
  async getLogs(filter: {
        fromBlock?: string | bigint;
        toBlock?: string | bigint;
        address?: string | string[];
        topics?: (string | string[] | null)[];
    }) {
    const formattedFilter = {
      ...filter,
      fromBlock: typeof filter.fromBlock === 'bigint'
        ? `0x${filter.fromBlock.toString(16)}`
        : filter.fromBlock,
      toBlock: typeof filter.toBlock === 'bigint'
        ? `0x${filter.toBlock.toString(16)}`
        : filter.toBlock,
    };

    return this.request('eth_getLogs', [formattedFilter]);
  }

  /**
     * Utility function to sleep
     */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Get the RPC URL
     */
  getUrl(): string {
    return this.config.url;
  }
}

/**
 * Creates a Mezo RPC client from environment variables
 */
export function createMezoRpcClient(): MezoRpcClient {
  const rpcUrl = process.env.MEZO_RPC_URL || process.env.RPC_URL || 'http://localhost:8545';

  return new MezoRpcClient({
    url: rpcUrl,
    timeout: parseInt(process.env.MEZO_RPC_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.MEZO_RPC_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.MEZO_RPC_RETRY_DELAY || '1000', 10),
  });
}

