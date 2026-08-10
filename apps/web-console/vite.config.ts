import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const bridgeProxy = {
  '/health': 'http://127.0.0.1:8787',
  '/v1': 'http://127.0.0.1:8787',
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: bridgeProxy },
  preview: { proxy: bridgeProxy },
});
