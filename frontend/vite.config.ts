import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // API URL: use environment variable or default to localhost for development
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:4000';
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true, // Allow external connections (useful for testing on other devices)
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    // Build configuration for production
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
    },
  };
});
