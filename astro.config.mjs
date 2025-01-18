import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), tailwind()],
  buildOptions: {
    site: 'https://docs-ai-wheat.vercel.app/', // Substitua com a URL do seu site na Vercel
  },
  output: 'server',
  content: {
    collections: ['docs'],
  },
  adapter: node({
    mode: 'standalone'
  })
});