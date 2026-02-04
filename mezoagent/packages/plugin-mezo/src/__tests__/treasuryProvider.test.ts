import { describe, it, expect, beforeEach } from 'bun:test';
import { treasuryProvider } from '../providers/treasuryProvider';
import { createMockRuntime, createMockMemory } from './test-utils';
import type { IAgentRuntime, Memory } from '@elizaos/core';

describe('Treasury Provider', () => {
  let runtime: IAgentRuntime;
  let message: Memory;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
  });

  describe('get', () => {
    it('should provide treasury information', async () => {
      const result = await treasuryProvider.get(runtime, message);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('values');
    });

    it('should handle errors gracefully', async () => {
      const errorRuntime = createMockRuntime({
        getService: () => {
          throw new Error('Test error');
        },
      });

      const result = await treasuryProvider.get(errorRuntime, message);
      
      expect(result).toBeDefined();
    });
  });

  describe('provider metadata', () => {
    it('should have correct name', () => {
      expect(treasuryProvider.name).toBe('TREASURY_HEALTH');
    });

    it('should have description', () => {
      expect(treasuryProvider.description).toBeDefined();
    });
  });
});
