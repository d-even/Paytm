import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev` proxies /api to the Vyapaar Mitra backend (npm run dev in the project root, port 4000),
// so the app talks to the real agent with no CORS setup. Change BACKEND_URL if the backend runs elsewhere.
const backend = process.env.BACKEND_URL ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // also reachable from a phone on the same Wi-Fi
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
})
