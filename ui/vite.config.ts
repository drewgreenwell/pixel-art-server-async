import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
const BACKEND = process.env.VITE_SERVER_URL || 'http://192.168.1.35:8080';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    proxy: {
      // Proxy all non-asset requests to the backend so Chrome's Private Network
      // Access policy is never triggered (page and API share the same origin).
      '/images': BACKEND,
      '/imagesets': BACKEND,
      '/imageset': BACKEND,
      '/clients': BACKEND,
      '/upload': BACKEND,
      '/upload-json': BACKEND,
      '/edit-file': BACKEND,
      '/delete-image': BACKEND,
      '/wled': BACKEND,
      '/api': BACKEND,
      '/image-preview': BACKEND,
    },
  },
})
