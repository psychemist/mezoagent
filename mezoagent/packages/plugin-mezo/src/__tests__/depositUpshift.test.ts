import { describe, it, expect, beforeEach } from 'bun:test';
import { depositUpshiftAction } from '../actions/depositUpshift';
import { createMockRuntime, createMockMemory } from './test-utils';
import type { IAgentRuntime, Memory } from '@elizaos/core';

describe('depositUpshift Action', () => {
  let runtime: IAgentRuntime;
  let message: Memory;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
  });

  describe('validate', () => {
    it('should validate messages with deposit keywords', async () => {
      message.content.text = 'Deposit 1 BTC into Upshift';
      const result = await depositUpshiftAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should validate messages with invest keywords', async () => {
      message.content.text = 'Invest in Upshift';
      const result = await depositUpshiftAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should validate messages with stake keywords', async () => {
      message.content.text = 'Stake BTC in Upshift';
      const result = await depositUpshiftAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it('should not validate messages without deposit keywords', async () => {
      message.content.text = 'What is this protocol?';
      const result = await depositUpshiftAction.validate(runtime, message);
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    it('should handle deposit with valid parameters', async () => {
      message.content.text = 'Deposit 1 BTC into Upshift';
      
      const result = await depositUpshiftAction.handler(runtime, message);
      
      // The handler should return a result
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('should handle deposit without amount', async () => {
      message.content.text = 'Deposit BTC into Upshift';
      
      const result = await depositUpshiftAction.handler(runtime, message);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('action metadata', () => {
    it('should have correct name', () => {
      expect(depositUpshiftAction.name).toBe('DEPOSIT_UPSHIFT');
    });

    it('should have correct description', () => {
      expect(depositUpshiftAction.description).toContain('Deposit');
    });

    it('should have similes', () => {
      expect(depositUpshiftAction.similes).toBeDefined();
      expect(Array.isArray(depositUpshiftAction.similes)).toBe(true);
    });
  });
});
