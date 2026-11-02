import { defineConfig } from 'vite';

// Khi dev: Vite chạy ở :5173, server game ở :8787.
// Proxy /ws để trình duyệt chỉ cần kết nối cùng domain (giống production).
export default defineConfig({
  server: {
    host: true, // cho phép điện thoại cùng mạng Wi-Fi vào thử
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1000 },
});
