import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://eacy.cinocore.com:5001',
        changeOrigin: true,
        autoRewrite: true,
        followRedirects: true,
      },
    },
  },
})
