// Drafts are visible in `pnpm dev` (to preview them) but never in production builds.
export const isVisible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;
