import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cssEditor } from '@editable-jsx/css';

export default defineConfig({
  plugins: [react(), cssEditor()],
});
