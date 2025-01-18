import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  content: {
    collections: ['docs'],
  },
  adapter: node({
    mode: 'standalone'
  })
});