import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  build: {
    rolldownOptions: { input: { principal: "index.html", visor: "visor-espacios.html" } },
  },
  server: {
    port: 5173,
    strictPort: true,
    // AQUÍ ESTÁ LA MAGIA DEL PROXY INVERSO
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
});
