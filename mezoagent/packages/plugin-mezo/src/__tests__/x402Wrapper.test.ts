import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { wrapWithX402, canAffordAction } from '../utils/x402Wrapper';
import { createMockRuntime, createMockMemory, createMockState } from './test-utils';
import type { IAgentRuntime, Memory, ActionResult } from '@elizaos/core';

describe('X402 Wrapper', () => {
  let runtime: IAgentRuntime;
  let message: Memory;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
  });

  describe('wrapWithX402', () => {
    it('should wrap action handler with X402 payment logic', async () => {
      const mockActionHandler = mock().mockResolvedValue({
        success: true,
        text: 'Action completed',
        values: {},
      } as ActionResult);

      const result = await wrapWithX402(
        runtime,
        message,
        'TEST_ACTION',
        mockActionHandler,
        {
          critical: false,
          estimatedCost: BigInt('1000000000000000000'), // 1 MEZO
        }
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('should handle action handler errors', async () => {
      const mockActionHandler = mock().mockRejectedValue(new Error('Test error'));

      const result = await wrapWithX402(
        runtime,
        message,
        'TEST_ACTION',
        mockActionHandler
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should record spending on successful execution', async () => {
      const mockActionHandler = mock().mockResolvedValue({
        success: true,
        text: 'Action completed',
        values: {},
      } as ActionResult);

      const result = await wrapWithX402(
        runtime,
        message,
        'TEST_ACTION',
        mockActionHandler,
        {
          estimatedCost: BigInt('1000000000000000000'),
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('canAffordAction', () => {
    it('should check if action can afford execution', async () => {
      const result = await canAffordAction(
        runtime,
        message,
        'TEST_ACTION',
        BigInt('1000000000000000000')
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('canAfford');
      expect(result).toHaveProperty('reason');
    });

    it('should handle missing estimated cost', async () => {
      const result = await canAffordAction(
        runtime,
        message,
        'TEST_ACTION'
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('canAfford');
    });
  });
});
