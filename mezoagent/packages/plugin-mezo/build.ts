#!/usr/bin/env bun
/**
 * Build script for @elizaos/plugin-mezo using standardized build utilities
 */

import { createBuildRunner } from '../../build-utils';

// Create and run the standardized build runner
const run = createBuildRunner({
    packageName: '@elizaos/plugin-mezo',
    buildOptions: {
        entrypoints: ['src/index.ts'],
        outdir: 'dist',
        target: 'node',
        format: 'esm',
        external: [
            '@elizaos/core',
        ],
        sourcemap: true,
        minify: false,
        generateDts: true,
    },
});

// Execute the build
run().catch((error) => {
    console.error('Build script error:', error);
    process.exit(1);
});
