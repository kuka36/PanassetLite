import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { llmProxyPlugin } from './vite-plugin-llm-proxy'

export default defineConfig({
  // GitHub Pages project site sets VITE_BASE=/RepoName/ in deploy workflow
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), llmProxyPlugin()],
})
