#!/usr/bin/env node
// Re-import every post that came from HackMD (has a `hackmd:` link) and report what changed.
//
//   pnpm sync-hackmd
//
// Bodies are refreshed from HackMD; front matter you edited is kept. Posts whose note changed get an
// `updated:` date. Nothing is committed: review with `pnpm dev`, then commit and push.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = 'src/content/writing';
const posts = [];
for (const d of await readdir(root, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const text = await readFile(join(root, d.name, 'index.md'), 'utf8').catch(() => '');
  const url = text.match(/^hackmd:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim();
  if (url) posts.push({ slug: d.name, url });
}

if (!posts.length) {
  console.log('No posts with a `hackmd:` link found.');
  process.exit(0);
}

console.log(`Syncing ${posts.length} post${posts.length > 1 ? 's' : ''} from HackMD…\n`);
const counts = { Updated: 0, Unchanged: 0, Failed: 0 };
for (const { slug, url } of posts) {
  const r = spawnSync(process.execPath, ['scripts/import-hackmd.mjs', url, slug], {
    encoding: 'utf8',
    env: { ...process.env, HACKMD_QUIET: '1' },
  });
  const first = (r.stdout || '').trim().split('\n').find((l) => /^(Created|Updated|Unchanged) /.test(l));
  const status = r.status === 0 && first ? first.split(' ')[0] : 'Failed';
  counts[status === 'Created' ? 'Updated' : status] = (counts[status === 'Created' ? 'Updated' : status] ?? 0) + 1;
  const mark = { Updated: '↻', Created: '+', Unchanged: '·', Failed: '✗' }[status];
  console.log(`  ${mark} ${status.padEnd(9)} ${slug}`);
  if (status === 'Failed') console.log(`      ${(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join('\n      ')}`);
  for (const w of (r.stderr || '').split('\n').filter((l) => l.includes('!'))) console.log(`      ${w.trim()}`);
}

console.log(`\n${counts.Updated} updated, ${counts.Unchanged} unchanged${counts.Failed ? `, ${counts.Failed} failed` : ''}.`);
if (counts.Updated) console.log('Review with `pnpm dev` (restart it if it is running), then commit and push.');
process.exit(counts.Failed ? 1 : 0);
