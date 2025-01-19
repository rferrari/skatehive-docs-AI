import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), tailwind()],
  buildOptions: {
    site: 'https://docs-ai-wheat.vercel.app/', 
  },
 
  output: 'static',
  adapter: vercel(),

  content: {
    collections: {
      docs: {
        schema: {
          id: String,
          title: String,
          description: String,
          version: String,
          position: Number,
          order: Number,
          keywords: Array,
        },
      },
    },
  },
});
