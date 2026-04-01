import esbuild from 'esbuild';
import { chmodSync, existsSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const isDev = process.argv.includes('--dev');
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');
const entryFile = path.join(distDir, 'semiclaw-code.js');
const packageJson = JSON.parse(
  await readFile(path.join(rootDir, 'package.json'), 'utf8'),
);

// External/public builds should exclude internal-only feature-gated code paths.
const enabledFeatures = new Set();

const macroValues = Object.freeze({
  VERSION: packageJson.version,
  BUILD_TIME: new Date().toISOString(),
  VERSION_CHANGELOG: '',
  PACKAGE_URL: packageJson.name,
  NATIVE_PACKAGE_URL: null,
  FEEDBACK_CHANNEL: 'the Semiclaw Code issue tracker',
  ISSUES_EXPLAINER: 'open an issue with the Semiclaw Code maintainers',
});

const loaders = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
};

const extensionsToTry = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const featureImportPattern =
  /^import\s+\{\s*feature\s*\}\s+from\s+['"]bun:bundle['"];?\n?/m;
const featureCallPattern = /\bfeature\(\s*(['"])([A-Z0-9_]+)\1\s*,?\s*\)/g;
function detectLoader(filePath) {
  return loaders[path.extname(filePath)] ?? 'js';
}

function tryResolveLocalImport(importPath, resolveDir) {
  const candidatePath = path.resolve(resolveDir, importPath);
  if (existsSync(candidatePath)) {
    return candidatePath;
  }

  const extension = path.extname(importPath);
  if (!['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    return null;
  }

  const withoutExtension = candidatePath.slice(0, -extension.length);
  for (const extension of extensionsToTry) {
    const nextCandidate = `${withoutExtension}${extension}`;
    if (existsSync(nextCandidate)) {
      return nextCandidate;
    }
  }

  return null;
}

const packagingPlugin = {
  name: 'node-cli-packaging',
  setup(build) {
    build.onResolve({ filter: /^bun:bundle$/ }, () => ({
      path: 'bun:bundle',
      namespace: 'feature-shim',
    }));

    build.onResolve({ filter: /^[^./].*/ }, args => {
      if (args.path.startsWith('src/') || args.path.startsWith('node:')) {
        return null;
      }

      return { path: args.path, external: true };
    });

    build.onResolve({ filter: /^\.\.?\// }, args => {
      const resolvedPath = tryResolveLocalImport(args.path, args.resolveDir);
      if (resolvedPath) {
        return { path: resolvedPath };
      }

      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'empty-module',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'feature-shim' }, () => ({
      contents: 'export const feature = () => false;\n',
      loader: 'js',
    }));
    build.onLoad({ filter: /.*/, namespace: 'empty-module' }, args => ({
      contents: `console.warn(${JSON.stringify(
        `[build] Optional module stubbed at runtime: ${path.relative(
          rootDir,
          args.path,
        )}`,
      )});\nexport default {};\n`,
      loader: 'js',
    }));

    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async args => {
      if (!args.path.startsWith(srcDir)) {
        return null;
      }

      let contents = await readFile(args.path, 'utf8');

      contents = contents.replace(featureImportPattern, '');
      contents = contents.replace(
        featureCallPattern,
        (_, quote, name) => (enabledFeatures.has(name) ? 'true' : 'false'),
      );

      return {
        contents,
        loader: detectLoader(args.path),
      };
    });
  },
};

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await esbuild.build({
    entryPoints: {
      'semiclaw-code': './src/entrypoints/cli.tsx',
    },
    outdir: './dist',
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: ['node18'],
    mainFields: ['module', 'main'],
    tsconfig: './tsconfig.json',
    sourcemap: isDev,
    minify: false,
    logLevel: 'info',
    loader: {
      '.md': 'text',
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        isDev ? 'development' : 'production',
      ),
      MACRO: JSON.stringify(macroValues),
    },
    plugins: [packagingPlugin],
  });

  const entryContents = await readFile(entryFile, 'utf8');
  if (!entryContents.startsWith('#!/usr/bin/env node')) {
    await writeFile(entryFile, `#!/usr/bin/env node\n${entryContents}`);
  }
  chmodSync(entryFile, 0o755);

  console.log('Build completed for ./dist/semiclaw-code.js');
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
