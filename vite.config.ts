import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function moduleLogger() {
  return {
    name: 'module-logger',
    enforce: 'pre',
    resolveId(id: string) {
      if (id === 'react' || id === 'react-dom' || id === 'react-dom/client' || id.includes('use-sync-external-store')) {
        console.log(`[resolve] ${id}`)
      }
    },
    load(id: string) {
      if (id.includes('react.development.js') || id.includes('react-dom.development.js')) {
        console.log(`[load] ${id}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [moduleLogger(), react(), tailwindcss()],
  logLevel: 'info',
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client.js'),
      'use-sync-external-store': path.resolve(__dirname, 'node_modules/use-sync-external-store'),
    },
    dedupe: ['react', 'react-dom', 'use-sync-external-store'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter', 'use-sync-external-store/shim'],
    force: true,
  },
})
