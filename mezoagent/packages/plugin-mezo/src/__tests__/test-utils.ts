import { mock } from 'bun:test';
import {
  type IAgentRuntime,
  type Memory,
  type State,
  type UUID,
  type Character,
} from '@elizaos/core';

/**
 * Creates a mock runtime for testing Mezo plugin components
 */
export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  return {
    agentId: 'test-agent-id' as UUID,
    character: {
      name: 'Test Agent',
    } as Character,
    logger: {
      debug: mock(),
      warn: mock(),
      error: mock(),
      info: mock(),
    },
    getService: mock().mockReturnValue(null),
    getMemories: mock().mockResolvedValue([]),
    composeState: mock().mockResolvedValue({ values: {}, data: {} }),
    ...overrides,
  } as IAgentRuntime;
}

/**
 * Creates a mock memory object for testing
 */
export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'test-memory-id' as UUID,
    agentId: 'test-agent-id' as UUID,
    roomId: 'test-room-id' as UUID,
    userId: 'test-user-id' as UUID,
    content: {
      text: 'Swap 1 tBTC for MUSD',
    },
    createdAt: Date.now(),
    ...overrides,
  } as Memory;
}

/**
 * Creates a mock state object for testing
 */
export function createMockState(overrides: Partial<State> = {}): State {
  return {
    action: 'SWAP_TIGRIS',
    params: {},
    ...overrides,
  } as State;
}
