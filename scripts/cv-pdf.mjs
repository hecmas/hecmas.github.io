#!/usr/bin/env node
// Render the /cv page to public/uploads/resume.pdf with headless Chrome.
//
//   pnpm cv          (builds the site first, then runs this script)
//
// Serves dist/ on a temporary local port, prints /cv with the page's print styles (A4),
// and writes the PDF. Set CHROME=/path/to/chrome if Chrome is not in the default location.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const DIST = resolve('dist');
const OUT = resolve('public/uploads/resume.pdf');
const CHROME =
  process.env.CHROME ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);

if (!existsSync(join(DIST, 'cv', 'index.html'))) {
  console.error('dist/cv/index.html not found: run `pnpm build` first (or use `pnpm cv`).');
  process.exit(1);
}
if (!CHROME) {
  console.error('Chrome not found. Install it or set CHROME=/path/to/chrome.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.pdf': 'application/pdf',
};

const server = createServer(async (req, res) => {
  try {
    let path = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(DIST)) throw new Error('outside dist');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { port } = server.address();

// Chrome must run asynchronously: our server has to keep answering its requests meanwhile.
const result = await new Promise((done) => {
  let stderr = '';
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=8000',
    `--print-to-pdf=${OUT}`,
    `http://127.0.0.1:${port}/cv/`,
  ]);
  chrome.stderr.on('data', (d) => (stderr += d));
  chrome.on('close', (status) => done({ status, stderr }));
});
server.close();

if (result.status !== 0 || !existsSync(OUT)) {
  console.error('Chrome failed to print the CV:\n' + (result.stderr || '').split('\n').slice(-5).join('\n'));
  process.exit(1);
}
const kb = Math.round((await stat(OUT)).size / 1024);
console.log(`Wrote ${OUT.replace(resolve('.') + '/', '')} (${kb} KB). Commit it to publish.`);
