import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.object({ label: z.string(), url: z.string() });

const writing = defineCollection({
  loader: glob({ pattern: '**/index.{md,mdx}', base: './src/content/writing', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

const publications = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/publications' }),
  schema: z.object({
    title: z.string(),
    // Use "me" for yourself; it gets rendered as your name, highlighted.
    authors: z.array(z.string()),
    date: z.coerce.date(),
    venue: z.string().optional(),
    type: z.enum(['journal', 'conference', 'preprint', 'thesis']),
    abstract: z.string(),
    links: z.array(link).default([]),
    bibtex: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const talks = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/talks' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    event: z.string(),
    eventUrl: z.string().optional(),
    location: z.string(),
    coSpeakers: z.array(z.string()).default([]),
    abstract: z.string().optional(),
    youtube: z.string().optional(), // YouTube video id
    slides: z.string().optional(),
  }),
});

export const collections = { writing, publications, talks };
