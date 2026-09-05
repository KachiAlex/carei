import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'carei-pages',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: false, // Use existing public/manifest.json
    }),
  ],
  logLevel: 'warn',
  server: {
    proxy: {
      '/api': {
        target: 'https://carei-app.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'use-sync-external-store'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'wouter', 'use-sync-external-store'],
          'animation': ['framer-motion'],
          'charts': ['recharts'],
          'aws-s3': ['@aws-sdk/client-s3'],
          'icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
