import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.VITE_HF_TOKEN': JSON.stringify(env.VITE_HF_TOKEN || ''),
      'process.env.VITE_HF_TOKEN_POOL': JSON.stringify(env.VITE_HF_TOKEN_POOL || ''),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
      'process.env.VITE_SILICONFLOW_API_KEY': JSON.stringify(env.VITE_SILICONFLOW_API_KEY || ''),
      'process.env.VITE_GLM_API_KEY': JSON.stringify(env.VITE_GLM_API_KEY || '')
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'icons-vendor': ['lucide-react'],
            'gradio-vendor': ['@gradio/client'],
            'zip-vendor': ['jszip']
          }
        }
      }
    }
  };
});
