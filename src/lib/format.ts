import { profile } from '../data/site';

export const formatDate = (d: Date, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  d.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

export const year = (d: Date) => d.getUTCFullYear();

/** Replace "me" with your name; mark it so it can be highlighted. */
export const authorList = (authors: string[]) =>
  authors.map((a) => (a === 'me' ? { name: profile.name, me: true } : { name: a, me: false }));

export const readingTime = (body = '') => Math.max(1, Math.round(body.split(/\s+/).length / 220));
