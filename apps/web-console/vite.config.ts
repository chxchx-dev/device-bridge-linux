import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const bridgeProxy = {
  '/health': 'http://127.0.0.1:8787',
  '/v1': 'http://127.0.0.1:8787',
};
const tailnetHost = 'chxchxn-laptop.tail33e808.ts.net';

export default defineConfig({
  plugins: [react()],
  server: { proxy: bridgeProxy, allowedHosts: [tailnetHost] },
  preview: { proxy: bridgeProxy, allowedHosts: [tailnetHost] },
});
