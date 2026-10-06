import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // NLDD ships Lit-based web components; compile <nldd-*> straight to DOM elements.
          isCustomElement: (tag) => tag.startsWith('nldd-'),
        },
      },
    }),
  ],
  // 5173/8000 are taken by invulhulp in local development.
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8010', changeOrigin: true },
    },
  },
})
