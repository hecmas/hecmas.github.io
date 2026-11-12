#!/usr/bin/env node
// Import a HackMD note as a draft post.
//
//   pnpm import-hackmd <hackmd-url> [slug]
//
// Creates src/content/writing/<slug>/index.md with `draft: true`. Re-running it for the same
// note replaces the body but keeps the front matter you edited (title, summary, date, tags, draft).
// Public notes ("anyone with the link can read") work as-is. For private notes, create a token in
// HackMD (Settings → API → Create API token) and put HACKMD_TOKEN=... in a .env file (gitignored).

import { mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises';
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

// If this note was imported before, update that post (even if the title changed since).
async function findExistingSlug() {
  const root = 'src/content/writing';
  for (const d of await readdir(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const text = await readFile(join(root, d.name, 'index.md'), 'utf8').catch(() => '');
    const m = text.match(/^hackmd:\s*"?([^"\n]+)"?\s*$/m);
    if (m && m[1].trim() === noteUrl) return d.name;
  }
  return null;
}
const existingSlug = await findExistingSlug();

const slug =
  slugArg ||
  existingSlug ||
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
// $$ fences sharing a line with content (`$$\begin{aligned}` … `\end{aligned}$$`): HackMD accepts
// them, but remark-math treats text after an opening $$ as a label and drops it. Split them.
md = md
  .replace(/^([ \t>]*)\$\$([^$\n]*\S[^$\n]*)$/gm, '$1$$$$\n$1$2')
  .replace(/^([ \t>]*)([^$\n]*[^\s>$][^$\n]*)\$\$[ \t]*$/gm, '$1$2\n$1$$$$');

// HackMD renders math with MathJax, which accepts bare \begin{align}…\end{align} blocks without $$.
// remark-math needs the $$ fences, so wrap any LaTeX environment that is not already inside math.
export function wrapBareEnvs(text) {
  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  let inMath = false;
  let env = null; // { name, depth, prefix }
  for (const line of lines) {
    const m = line.match(/^([ \t>]*)(.*)$/);
    const prefix = m[1];
    const rest = m[2];
    if (/^(```|~~~)/.test(rest) && !env) inFence = !inFence;
    if (!inFence && !env && rest.trim() === '$$') inMath = !inMath;
    if (!inFence && !inMath && !env) {
      const open = rest.match(/^\\begin\{([a-zA-Z*]+)\}/);
      if (open) {
        env = { name: open[1], depth: 0, prefix };
        out.push(prefix + '$$');
      }
    }
    out.push(line);
    if (env) {
      const esc = env.name.replace('*', '\\*');
      env.depth += (rest.match(new RegExp(`\\\\begin\\{${esc}\\}`, 'g')) || []).length;
      env.depth -= (rest.match(new RegExp(`\\\\end\\{${esc}\\}`, 'g')) || []).length;
      if (env.depth <= 0) {
        out.push(env.prefix + '$$');
        env = null;
      }
    }
  }
  return out.join('\n');
}
md = wrapBareEnvs(md);
// Numbered environments (align, gather, equation) get equation numbers in KaTeX but not in HackMD.
// Use their unnumbered equivalents so posts look like the notes.
export const unnumber = (t) =>
  t
    .replace(/\\(begin|end)\{align\*?\}/g, '\\$1{aligned}')
    .replace(/\\(begin|end)\{gather\*?\}/g, '\\$1{gathered}')
    .replace(/\\(?:begin|end)\{equation\*?\}/g, '');
md = unnumber(md);

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
    // HackMD heading anchors keep capitals (#Final-Exponentiation); the site's are lowercase.
    .replace(/\]\(#([^)\s]+)\)/g, (_, a) => `](#${a.toLowerCase().replace(/[^\w-]/g, '')})`)
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

// Raw <img> tags pointing at local files are not bundled by Astro; use Markdown images instead.
body = body.replace(/(?:<p[^>]*>\s*)?<img[^>]*?src="(\.\/[^"]+)"[^>]*?>(?:\s*<\/p>)?/g, (tag, src) => {
  const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? '';
  return `![${alt}](${src})`;
});

// ── Summary ───────────────────────────────────────────────────────────────────
// A good summary says what the post shows, which the opening paragraph rarely does, so it is not
// generated. Uses the note's HackMD description if set; otherwise a TODO that blocks publishing.
const summary = (api?.description || meta.description || '').trim();

// ── Write (keep edited front matter on re-import) ────────────────────────────
const file = join(dir, 'index.md');
const exists = await access(file).then(() => true, () => false);
const yaml = (s) => JSON.stringify(s);
let front;
let oldBody = '';
if (exists) {
  const old = await readFile(file, 'utf8');
  front = old.match(/^---\n[\s\S]*?\n---\n/)?.[0];
  oldBody = old.slice(front?.length ?? 0).replace(/^\n/, '');
  // Keep image descriptions added on the site when the note has none.
  const oldAlts = new Map([...oldBody.matchAll(/!\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => [m[2], m[1]]));
  body = body.replace(/!\[\]\(([^)\s]+)\)/g, (all, src) => (oldAlts.has(src) ? `![${oldAlts.get(src)}](${src})` : all));
}
const changed = !exists || oldBody.trim() !== body.trim();

if (exists && changed && front) {
  // Record when the post last changed: HackMD's last edit if known, otherwise today.
  const when = new Date(api?.lastChangedAt ?? Date.now()).toISOString().slice(0, 10);
  const date = front.match(/^date:\s*(\S+)/m)?.[1];
  if (when !== date) {
    front = /^updated:/m.test(front)
      ? front.replace(/^updated:.*$/m, `updated: ${when}`)
      : front.replace(/^(date:.*)$/m, `$1\nupdated: ${when}`);
  }
}

front ??= `---
title: ${yaml(title)}
summary: ${yaml(summary || 'TODO: write a one-sentence summary of what this post shows')}
date: ${new Date(api?.createdAt ?? Date.now()).toISOString().slice(0, 10)}
tags: [${(api?.tags?.length ? api.tags : (meta.tags || '').split(/[,\s]+/)).filter(Boolean).map(yaml).join(', ')}]
draft: true
hackmd: ${yaml(noteUrl)}
---
`;
if (changed) await writeFile(file, `${front}\n${body}`);

// First line is machine-readable for `pnpm sync-hackmd`: Created | Updated | Unchanged.
console.log(`${!exists ? 'Created' : changed ? 'Updated' : 'Unchanged'} ${file}${n ? ` (+${n} image${n > 1 ? 's' : ''})` : ''}`);
if (process.env.HACKMD_QUIET) process.exit(0);
console.log(`Preview: pnpm dev, then http://localhost:4321/writing/${slug}/ (drafts show in dev only)`);
if (!exists) {
  console.log(summary ? 'Check the summary, date and tags; set draft: false to publish.'
    : 'Write the summary (it says TODO; the site refuses to publish it until you do), check date and tags,\nthen set draft: false to publish.');
  console.log('New post: if `pnpm dev` is already running, restart it to pick the post up.');
}
