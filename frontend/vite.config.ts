import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// El API se sirve por el mismo origen gracias al proxy: la cookie del refresh
// (SameSite=Strict, path /api/v1/auth) viaja sin configurar CORS en el navegador.
const API = process.env.VITE_API_PROXY ?? 'http://localhost:3000';
const proxy = { '/api': { target: API, changeOrigin: true }, '/uploads': { target: API, changeOrigin: true } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
