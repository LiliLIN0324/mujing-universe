import { defineConfig } from 'astro/config';

// Absolute URLs for WeChat / OG. Override with SITE= when the public domain changes.
const site = process.env.SITE || 'https://mujing-universe.pages.dev';

export default defineConfig({
  site,
  trailingSlash: 'always',
  server: { port: 4471, host: true },
});
