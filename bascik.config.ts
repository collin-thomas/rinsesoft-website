import { defineConfig } from '@bascik/bascik/config';

export default defineConfig({
  directory: {
    pages: 'src/pages',
    components: 'src/components',
  },
  siteUrl: 'https://rinsesoft.com',
});

export const build = defineConfig({
  minify: {
    html: true,
    css: true,
    js: true,
    identifiers: true,
  },
});
