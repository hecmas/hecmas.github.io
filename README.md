# Personal Website

Source for [hecmas.github.io](https://hecmas.github.io), built with [Astro](https://astro.build).

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

## License

- **Code:** [MIT](LICENSE). This covers everything not listed below.
- **Blog posts** in `src/content/writing/` (text, figures and demos):
  [CC BY 4.0](src/content/writing/LICENSE), © Héctor Masip Ardevol. Reuse them freely with credit and a link
  to the original.
- **Not licensed (all rights reserved):** personal images (`src/assets/me.png`, `public/avatar.png`,
  `public/favicon.png`), documents in `public/uploads/` (CV, theses, slides), and papers listed in
  `src/content/publications/`, which remain under their publishers' and co-authors' terms.
