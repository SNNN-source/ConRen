/**
 * Vite configuration for the frontend.
 *
 * Beginner note:
 * Vite is the tool that runs the frontend during development and builds it for
 * production. This file customizes that behavior.
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Load values from `.env` files so the config can use them.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expose the Gemini key to frontend code if AI features are added later.
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // Allow shorter imports using `@`.
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Hot reloading refreshes the page quickly during development.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          // Forward local API requests to the FastAPI backend.
          target: 'http://127.0.0.1:8000',
          changeOrigin: true
        }
      }
    },
  };
});
