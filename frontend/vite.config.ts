import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env from the frontend directory (where .env lives)
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        // '@/foo' resolves to '<frontend>/src/foo'
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Vite automatically exposes VITE_* vars from .env via import.meta.env —
    // no need to manually define them here. We only need define for non-VITE_ vars
    // that we explicitly want in the bundle.
  };
});
