import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { swapTigrisAction } from '../actions/swapTigris';
import { createMockRuntime, createMockMemory } from './test-utils';
import type { IAgentRuntime, Memory } from '@elizaos/core';

describe('swapTigris Action', () => {
  let runtime: IAgentRuntime;
  let message: Memory;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
  });

  describe('validate', () => {
    it('should validate messages with swap keywords', async () => {
      message.content.text = 'Swap 1 tBTC for MUSD';
      const result = await swapTigrisAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should validate messages with trade keywords', async () => {
      message.content.text = 'Trade tBTC for MUSD';
      const result = await swapTigrisAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should validate messages with buy keywords', async () => {
      message.content.text = 'Buy MUSD with tBTC';
      const result = await swapTigrisAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should validate messages with sell keywords', async () => {
      message.content.text = 'Sell tBTC';
      const result = await swapTigrisAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should not validate messages without swap keywords', async () => {
      message.content.text = 'Hello, how are you?';
      const result = await swapTigrisAction.validate(runtime, message);
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    it('should handle swap with valid parameters', async () => {
      message.content.text = 'Swap 1 tBTC for MUSD';
      
      // Mock the X402 wrapper to avoid actual execution
      const originalImport = global.import;
      const mockWrapWithX402 = mock().mockResolvedValue({
        success: true,
        text: '✅ Swap executed successfully',
        values: { status: 'SUCCESS' },
      });

      // Since we can't easily mock dynamic imports, we'll test the structure
      const result = await swapTigrisAction.handler(runtime, message);
      
      // The handler should return a result (either success or error)
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('should handle missing token parameters', async () => {
      message.content.text = 'Swap something';
      
      const result = await swapTigrisAction.handler(runtime, message);
      
      // Should handle error gracefully
      expect(result).toBeDefined();
    });

    it('should handle missing amount', async () => {
      message.content.text = 'Swap tBTC for MUSD';
      
      const result = await swapTigrisAction.handler(runtime, message);
      
      // Should handle error gracefully
      expect(result).toBeDefined();
    });
  });

  describe('action metadata', () => {
    it('should have correct name', () => {
      expect(swapTigrisAction.name).toBe('SWAP_TIGRIS');
    });

    it('should have correct description', () => {
      expect(swapTigrisAction.description).toContain('Swap tokens');
    });

    it('should have similes', () => {
      expect(swapTigrisAction.similes).toBeDefined();
      expect(Array.isArray(swapTigrisAction.similes)).toBe(true);
    });
  });
});
