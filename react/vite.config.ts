import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
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
  }
})
