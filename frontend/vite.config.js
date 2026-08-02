import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/topology': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
      '/ws': { target: 'http://localhost:8000', ws: true },
    },
  },
})
