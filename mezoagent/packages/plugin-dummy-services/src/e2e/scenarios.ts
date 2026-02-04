import { type TestSuite, type IAgentRuntime } from '@elizaos/core';

/**
 * E2E test scenarios for dummy services plugin
 */
export const dummyServicesScenariosSuite: TestSuite = {
  name: 'dummy-services-scenarios',
  tests: [
    {
      name: 'dummy_services_loaded',
      fn: async (_runtime: IAgentRuntime) => {
        // Basic test to verify plugin loads
        // If we get here without errors, the plugin is loaded
      },
    },
  ],
};
