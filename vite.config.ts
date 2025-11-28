import path from 'path';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        treeshake: true,
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) return 'recharts'
              if (id.includes('react-markdown')) return 'markdown'
              return 'vendor'
            }
          },
        },
      },
    },
    base: '/PanassetLite/', // Critical for GitHub Pages hosting
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Safely stringify env vars, fallback to empty string if undefined
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    resolve: {
      alias: {
        // Use process.cwd() instead of __dirname for ESM compatibility
        '@': path.resolve(process.cwd(), '.'),
      }
    }
  }
})