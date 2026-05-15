import { defineConfig } from 'astro/config';
import { astroEditor } from '@editable-jsx/astro';

export default defineConfig({
  integrations: [astroEditor()],
  server: { port: 4400 },
});
