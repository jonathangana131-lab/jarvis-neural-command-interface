import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    hmr: false,
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('/three/') || id.includes('\\three\\')) {
            return 'three';
          }
          if (id.includes('/@shoelace-style/') || id.includes('\\@shoelace-style\\')) {
            return 'shoelace';
          }
          if (id.includes('/gsap/') || id.includes('\\gsap\\')) {
            return 'motion';
          }
          if (id.includes('/lucide/') || id.includes('\\lucide\\')) {
            return 'icons';
          }
          return 'vendor';
        }
      }
    }
  }
});
