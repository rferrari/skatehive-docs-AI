import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), tailwind()],
  buildOptions: {
    site: 'https://docs-ai-wheat.vercel.app/', 
  },
 
  output: 'static',
  content: {
    collections: ['docs'],
  },
 
});