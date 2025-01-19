import { defineCollection, z } from 'astro:content';

const docsCollection = defineCollection({
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()).optional(),
    version: z.string(),
    order: z.number().optional(),
  }),
});

export const collections = {
  docs: docsCollection,
};
