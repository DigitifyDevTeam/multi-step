import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow access from other machines on your LAN
    host: true,
    port: 5173,
    proxy: {
      // Frontend calls `/api/...` so we forward it to Django.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
