#!/usr/bin/env node

/*
 * Simplified build script for creating a bundled version of Semiclaw Code
 * This approach bundles only the essential parts while preserving critical dynamic imports
 */

import esbuild from 'esbuild';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';

async function build() {
  console.log('Creating a simplified bundled version...');

  // Create dist directory if it doesn't exist
  await mkdir('./dist', { recursive: true });

  try {
    // Build a simplified version that preserves dynamic imports
    await esbuild.build({
      entryPoints: ['./src/entrypoints/cli.tsx'],
      bundle: true,
      platform: 'node',
      target: ['node18'],
      format: 'esm',
      outfile: './dist/semiclaw-code.js',
      external: [
        // Preserve all dynamic imports and complex modules
        'bun:*',
        '@anthropic-ai/*',
        '@aws-sdk/*',
        '@azure/*',
        'sharp',
        'turndown',
        'react',
        'ink',
        'vscode-*',
        'audio-capture-napi',
        'color-diff-napi',
        'modifiers-napi',
        // All potential dynamic import paths
        '../daemon/*',
        '../cli/*',
        '../server/*',
        '../environment-runner/*',
        '../self-hosted-runner/*',
        './server/*',
        './components/agents/*',
        '../../utils/*',
        '../*',
        './*',
        '*',
      ],
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      },
      minify: false, // Keep readable for debugging
      sourcemap: true,
      banner: {
        js: '#!/usr/bin/env node\n\n// This is a bundled version with external dependencies preserved\n',
      },
      allowOverwrite: true,
    });

    console.log('Simplified bundle created at ./dist/semiclaw-code.js');

    // Make the file executable
    await chmod('./dist/semiclaw-code.js', 0o755).catch(() => {});

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Simple chmod implementation since fs.promises.chmod doesn't work well cross-platform in some cases
function chmod(path, mode) {
  return import('fs').then(fs => new Promise((resolve, reject) => {
    fs.default.chmod(path, mode, (err) => {
      if (err) reject(err);
      else resolve();
    });
  }));
}

build();
