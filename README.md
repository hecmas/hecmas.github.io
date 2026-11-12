# hecmas.github.io

Personal site, built with [Astro](https://astro.build). Deployed to GitHub Pages on every push to `main`.

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static output in dist/
pnpm check      # type-check .astro/.ts files
```

## Where things live

| What | Where |
| --- | --- |
| Profile, social links, selected work, experience, education | `src/data/site.ts` |
| Blog posts | `src/content/writing/<slug>/index.md` (or `.mdx` to use components) |
| Publications | `src/content/publications/*.md` (front matter only) |
| Talks | `src/content/talks/*.md` (front matter only) |
| PDFs (CV, theses, slides) | `public/uploads/` |
| Colors, fonts, global styles | `src/styles/global.css` |

Front-matter fields are validated by the schemas in `src/content.config.ts`, so a typo fails the build.

## Writing posts

- Math: `$inline$` and `$$display$$`, rendered with KaTeX at build time.
- Callouts: GitHub-style `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`.
- Interactive demos: name the post `index.mdx`, then import a component, for example
  `src/components/demos/DegreeAdjustDemo.astro`.
- Set `draft: true` to hide a post.

Old Hugo URLs (`/post/...`, `/events`, `/experience`) redirect to their new locations (see `astro.config.mjs`).
