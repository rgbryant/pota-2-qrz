#!/usr/bin/env node
// Build script for POTA → QRZ Logger Chrome extension.
// Minifies JS with esbuild and copies static assets to dist/.

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');
const OUT = 'dist';

// Static files/directories to copy verbatim
const STATIC = ['manifest.json', 'popup.html', 'content.css', 'icons'];

function copyStatic() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const item of STATIC) {
    copyItem(item, path.join(OUT, item));
  }
}

function copyItem(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyItem(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const buildOptions = {
  entryPoints: ['content.js', 'background.js', 'popup.js'],
  outdir: OUT,
  bundle: false,   // No imports to resolve; just minify individual files
  minify: true,
  target: 'chrome120',
};

if (watch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [{
      name: 'copy-static',
      setup(build) {
        build.onEnd(() => copyStatic());
      },
    }],
  });
  copyStatic();
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  copyStatic();
  await esbuild.build(buildOptions);
  console.log('Build complete → dist/');
}
