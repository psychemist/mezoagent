import { describe, it, expect, beforeEach } from 'bun:test';
import { x402Provider } from '../providers/x402Provider';
import { createMockRuntime, createMockMemory } from './test-utils';
import type { IAgentRuntime, Memory } from '@elizaos/core';

describe('X402 Provider', () => {
  let runtime: IAgentRuntime;
  let message: Memory;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
  });

  describe('get', () => {
    it('should provide X402 payment information', async () => {
      const result = await x402Provider.get(runtime, message);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('values');
    });

    it('should handle errors gracefully', async () => {
      // Create a runtime that might cause errors
      const errorRuntime = createMockRuntime({
        getService: () => {
          throw new Error('Test error');
        },
      });

      const result = await x402Provider.get(errorRuntime, message);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });

  describe('provider metadata', () => {
    it('should have correct name', () => {
      expect(x402Provider.name).toBe('X402_PAYMENT');
    });

    it('should have description', () => {
      expect(x402Provider.description).toBeDefined();
    });
  });
});
