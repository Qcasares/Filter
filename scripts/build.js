// Build the WebExtension into extension/dist/. esbuild bundles each entry into
// a self-contained file so the source can stay as clean ES modules while the
// extension ships classic scripts (content scripts cannot be modules) and an
// inlined service worker. No framework, just bundling.

import { build, context } from 'esbuild';
import { cp, mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ext = resolve(root, 'extension');
const dist = resolve(ext, 'dist');

const entries = {
  background: resolve(ext, 'src/background.js'),
  content: resolve(ext, 'src/content/index.js'),
  popup: resolve(ext, 'src/popup/popup.js'),
  options: resolve(ext, 'src/options/options.js')
};

const buildOptions = {
  entryPoints: entries,
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'firefox115', 'edge110'],
  loader: { '.json': 'json' },
  legalComments: 'none',
  outdir: dist,
  logLevel: 'info'
};

async function copyStatic() {
  await copyFile(resolve(ext, 'src/popup/popup.html'), resolve(dist, 'popup.html'));
  await copyFile(resolve(ext, 'src/options/options.html'), resolve(dist, 'options.html'));
}

async function run() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  if (process.argv.includes('--watch')) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    await copyStatic();
    console.log('Hemisphere: watching for changes');
    return;
  }

  await build(buildOptions);
  await copyStatic();
  console.log('Hemisphere: built extension/dist');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
