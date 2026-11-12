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

## License

- **Code:** [MIT](LICENSE). This covers everything not listed below.
- **Blog posts** in `src/content/writing/` (text, figures and demos):
  [CC BY 4.0](src/content/writing/LICENSE), © Héctor Masip Ardevol. Reuse them freely with credit and a link
  to the original.
- **Not licensed (all rights reserved):** personal images (`src/assets/me.png`, `public/avatar.png`,
  `public/favicon.png`), documents in `public/uploads/` (CV, theses, slides), and papers listed in
  `src/content/publications/`, which remain under their publishers' and co-authors' terms.
