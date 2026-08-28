import {
  defineCollections,
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

/** Standalone MDX pages (nav links) — rendered without the docs sidebar layout. */
export const pages = defineDocs({
  dir: 'content/pages',
  docs: {
    schema: pageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    authors: z.array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
      }),
    ),
    date: z.string().date().or(z.date()),
    category: z.string().optional().default('Release'),
    hideToc: z.boolean().optional().default(false),
  }),
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});
