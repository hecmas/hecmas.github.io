#!/usr/bin/env node
// Import a HackMD note as a draft post.
//
//   pnpm import-hackmd <hackmd-url> [slug]
//
// Creates src/content/writing/<slug>/index.md with `draft: true`. Re-running it for the same
// note replaces the body but keeps the front matter you edited (title, summary, date, tags, draft).
// Public notes ("anyone with the link can read") work as-is. For private notes, create a token in
// HackMD (Settings → API → Create API token) and put HACKMD_TOKEN=... in a .env file (gitignored).

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';

const [url, slugArg] = process.argv.slice(2);
if (!url || !/hackmd\.io\//.test(url)) {
  console.error('Usage: pnpm import-hackmd <https://hackmd.io/...> [slug]');
  process.exit(1);
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
try {
  process.loadEnvFile(); // reads .env if present
} catch {}
const token = process.env.HACKMD_TOKEN;
const noteUrl = url.replace(/[?#].*$/, '').replace(/\/(edit|view|both|publish|download)$/, '');
let api = null; // note metadata from the API (title, tags, createdAt), when a token is used

async function fetchViaApi() {
  const headers = { Authorization: `Bearer ${token}` };
  const parts = new URL(noteUrl).pathname.split('/').filter(Boolean);
  let id = parts[0];
  if (id?.startsWith('@')) {
    // hackmd.io/@user/<permalink or id>: look the note up among your own notes.
    const r = await fetch('https://api.hackmd.io/v1/notes', { headers });
    if (!r.ok) throw new Error(`listing notes failed (HTTP ${r.status})`);
    const key = parts[1];
    const hit = (await r.json()).find(
      (n) => n.id === key || n.shortId === key || n.permalink === key || (n.publishLink || '').endsWith(`/${key}`),
    );
    if (!hit) throw new Error(`no note of yours matches "${key}"`);
    id = hit.id;
  }
  const r = await fetch(`https://api.hackmd.io/v1/notes/${id}`, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

let md;
if (token) {
  try {
    api = await fetchViaApi();
    md = api.content;
  } catch (e) {
    console.warn(`  ! HackMD API failed (${e.message}); trying the public download link.`);
  }
}
if (md == null) {
  const res = await fetch(`${noteUrl}/download`, { headers: { 'User-Agent': 'site-importer' } });
  if (!res.ok) {
    console.error(
      token
        ? `Could not read ${noteUrl} (HTTP ${res.status}). Check that the note is yours and the token is valid.`
        : `Could not read ${noteUrl} (HTTP ${res.status}). The note is probably private: create a token in\n` +
            'HackMD (Settings → API → Create API token) and add HACKMD_TOKEN=<token> to a .env file.',
    );
    process.exit(1);
  }
  md = await res.text();
}
md = md.replace(/\r\n/g, '\n');

// ── HackMD metadata (optional YAML block at the top) ─────────────────────────
let meta = {};
const fm = md.match(/^\s*---\n([\s\S]*?)\n---\n/);
if (fm) {
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  md = md.slice(fm[0].length);
}

// ── Title: first H1 (removed from the body; the page renders it) ─────────────
const h1 = md.match(/^[ \t]*#[ \t]+(.+?)[ \t]*$/m);
const title = (meta.title || h1?.[1] || api?.title || 'Untitled').replace(/^"|"$/g, '');
if (h1) md = md.replace(h1[0], '');

const slug =
  slugArg ||
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const dir = join('src/content/writing', slug);

// ── Keep blocks inside list items ────────────────────────────────────────────
// HackMD notes often put $$ blocks (and the sentence after them) at column 0 between list
// items. Markdown then closes the list and the numbering restarts at 1. Indent such lines to
// the item's content column, until a blank line is followed by unindented, non-item text.
function nestInLists(text) {
  const lines = text.split('\n');
  let indent = null;
  let prevBlank = false;
  let inFence = false;
  let inMath = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFence = /^\s*(```|~~~)/.test(line);
    const item = !inFence && !inMath && line.match(/^(\d+[.)]|[-*+])[ \t]+/);
    if (item) {
      indent = item[0].length;
      prevBlank = false;
      continue;
    }
    if (line.trim() === '') {
      prevBlank = true;
      continue;
    }
    if (indent !== null && !inFence && !inMath) {
      const unindented = !/^\s/.test(line);
      if ((prevBlank && unindented) || /^#{1,6}\s/.test(line) || /^\s*:::/.test(line)) indent = null;
    }
    if (indent !== null && !/^\s/.test(line)) lines[i] = ' '.repeat(indent) + line;
    if (isFence) inFence = !inFence;
    else if (!inFence && line.trim() === '$$') inMath = !inMath;
    prevBlank = false;
  }
  return lines.join('\n');
}
md = nestInLists(md);

// ── Convert HackMD-specific syntax, outside code fences ──────────────────────
const CALLOUT = { info: 'NOTE', success: 'TIP', warning: 'WARNING', danger: 'CAUTION' };
const LANG = { sage: 'python', sagemath: 'python', gp: 'text', pari: 'text', circom: 'rust' };

const out = [];
const stack = []; // open ::: containers
let inFence = false;
const prefix = () => stack.map((s) => (s.kind === 'callout' ? '> ' : '')).join('');

for (let line of md.split('\n')) {
  const fence = line.match(/^(\s*)(```+|~~~+)\s*([^\s=!{]*)\S*\s*$/);
  if (fence) {
    if (!inFence) {
      const lang = fence[3] ? LANG[fence[3].toLowerCase()] ?? fence[3] : '';
      line = `${fence[1]}${fence[2]}${lang}`; // drop HackMD line-number markers like ```rust=
    }
    inFence = !inFence;
    out.push(prefix() + line);
    continue;
  }
  if (inFence) {
    out.push(prefix() + line);
    continue;
  }

  const open = line.match(/^\s*:::\s*(\w+)\s*(.*)$/);
  if (open) {
    const kind = open[1].toLowerCase();
    if (kind === 'spoiler') {
      out.push(prefix() + `<details><summary>${open[2] || 'Details'}</summary>`, prefix());
      stack.push({ kind: 'spoiler' });
    } else {
      const label = CALLOUT[kind] ?? 'NOTE';
      out.push(prefix() + `> [!${label}]`);
      stack.push({ kind: 'callout' });
    }
    continue;
  }
  if (/^\s*:::\s*$/.test(line) && stack.length) {
    const closed = stack.pop();
    if (closed.kind === 'spoiler') out.push(prefix(), prefix() + '</details>');
    out.push('');
    continue;
  }

  if (/^\s*\[TOC\]\s*$/i.test(line)) continue; // posts get their own table of contents

  line = line
    .replace(/\{%\s*youtube\s+([\w-]+)\s*%\}/g, (_, id) =>
      `<iframe class="embed" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" allowfullscreen loading="lazy"></iframe>`)
    .replace(/\{%\s*(gist|vimeo|pdf|slideshare|speakerdeck)\s+(\S+)\s*%\}/g, (_, kind, ref) =>
      `[${kind}: ${ref}](${/^https?:/.test(ref) ? ref : `https://gist.github.com/${ref}`})`)
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
    .replace(/\$[^$\n]+\$/g, (m) => m.replace(/[’‘]/g, "'")); // KaTeX rejects typographic quotes

  out.push(prefix() + line);
}
let body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

// ── Images: copy remote images into the post folder ──────────────────────────
await mkdir(dir, { recursive: true });
const images = [...body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)|<img[^>]+src="(https?:\/\/[^"]+)"/g)];
let n = 0;
for (const m of images) {
  const src = m[1] || m[2];
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = r.headers.get('content-type') || '';
    const ext = extname(new URL(src).pathname) || (type.includes('png') ? '.png' : type.includes('svg') ? '.svg' : '.jpg');
    const file = `image-${++n}${ext}`;
    await writeFile(join(dir, file), Buffer.from(await r.arrayBuffer()));
    body = body.split(src).join(`./${file}`);
  } catch (e) {
    console.warn(`  ! kept remote image (download failed: ${e.message}): ${src}`);
  }
}

// ── Summary: first real paragraph, as plain text ─────────────────────────────
const firstPara =
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^([#>|<`$-]|\d+\.|\*[^*])/.test(p)) ?? '';
let summary = firstPara
  .replace(/\$\$?[^$]*\$\$?/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .trim();
if (summary.length > 200) summary = summary.slice(0, 200).replace(/\s+\S*$/, '') + '…';

// ── Write (keep edited front matter on re-import) ────────────────────────────
const file = join(dir, 'index.md');
const exists = await access(file).then(() => true, () => false);
const yaml = (s) => JSON.stringify(s);
let front;
if (exists) {
  front = (await readFile(file, 'utf8')).match(/^---\n[\s\S]*?\n---\n/)?.[0];
}
front ??= `---
title: ${yaml(title)}
summary: ${yaml(summary || 'TODO: one-sentence summary')}
date: ${new Date(api?.createdAt ?? Date.now()).toISOString().slice(0, 10)}
tags: [${(api?.tags?.length ? api.tags : (meta.tags || '').split(/[,\s]+/)).filter(Boolean).map(yaml).join(', ')}]
draft: true
hackmd: ${yaml(noteUrl)}
---
`;
await writeFile(file, `${front}\n${body}`);

console.log(`${exists ? 'Updated' : 'Created'} ${file}${n ? ` (+${n} image${n > 1 ? 's' : ''})` : ''}`);
console.log(`Preview: pnpm dev, then http://localhost:4321/writing/${slug}/ (drafts show in dev only)`);
if (!exists) console.log('Check the summary, date and tags; set draft: false to publish.');
