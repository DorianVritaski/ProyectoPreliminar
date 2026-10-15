import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Plugin para resolver rutas en alojamientos estáticos (Render, Vercel, Netlify, GitHub Pages)
 * Genera 404.html y carpetas con index.html para /eventos y /accesos
 */
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-plugin',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const indexPath = path.join(distDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        const indexHtml = fs.readFileSync(indexPath, 'utf-8')

        // 1. Fallback 404.html (Render sirve 404.html para cualquier ruta desconocida)
        fs.writeFileSync(path.join(distDir, '404.html'), indexHtml)

        // 2. Carpetas estáticas con index.html para acceso directo sin 404
        const routes = ['eventos', 'accesos']
        for (const r of routes) {
          const rDir = path.join(distDir, r)
          if (!fs.existsSync(rDir)) {
            fs.mkdirSync(rDir, { recursive: true })
          }
          fs.writeFileSync(path.join(rDir, 'index.html'), indexHtml)
        }
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
