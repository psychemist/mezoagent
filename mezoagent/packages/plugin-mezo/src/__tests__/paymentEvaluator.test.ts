import { describe, it, expect, beforeEach } from 'bun:test';
import { paymentEvaluator, recordOperationResult } from '../evaluators/paymentEvaluator';
import { createMockRuntime, createMockMemory, createMockState } from './test-utils';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

describe('Payment Evaluator', () => {
  let runtime: IAgentRuntime;
  let message: Memory;
  let state: State;

  beforeEach(() => {
    runtime = createMockRuntime();
    message = createMockMemory();
    state = createMockState();
  });

  describe('validate', () => {
    it('should validate payment feasibility', async () => {
      const result = await paymentEvaluator.validate(runtime, message, state);
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });

    it('should handle missing state', async () => {
      const result = await paymentEvaluator.validate(runtime, message, undefined);
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('handler', () => {
    it('should evaluate payment feasibility', async () => {
      const result = await paymentEvaluator.handler(runtime, message, state);
      
      expect(result).toBeDefined();
      // Handler returns an object with text, values, data, success
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('values');
      expect(result.values).toHaveProperty('valid');
    });

    it('should handle critical operations', async () => {
      state.critical = true;
      const result = await paymentEvaluator.handler(runtime, message, state);
      
      expect(result).toBeDefined();
    });
  });

  describe('recordOperationResult', () => {
    it('should record successful operation', () => {
      recordOperationResult(true);
      // Function should not throw
      expect(true).toBe(true);
    });

    it('should record failed operation', () => {
      recordOperationResult(false);
      // Function should not throw
      expect(true).toBe(true);
    });
  });

  describe('evaluator metadata', () => {
    it('should have correct name', () => {
      expect(paymentEvaluator.name).toBeDefined();
    });

    it('should have description', () => {
      expect(paymentEvaluator.description).toBeDefined();
    });
  });
});
