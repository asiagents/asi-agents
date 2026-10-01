import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@asi-api': path.resolve(__dirname, '../../../app/src/api.ts'),
      '@app-integrations': path.resolve(__dirname, '../../../app/src/components'),
      '@virtual-computer': path.resolve(__dirname, '../../../../modules/virtual-computer'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': 'http://127.0.0.1:3445',
      '/health': 'http://127.0.0.1:3445',
      '/registry': 'http://127.0.0.1:3445',
      '/ctl': 'http://127.0.0.1:3445',
      '/companion': 'http://127.0.0.1:3445',
    },
  },
})