import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { llmProxyPlugin } from './vite-plugin-llm-proxy'

export default defineConfig({
  plugins: [react(), tailwindcss(), llmProxyPlugin()],
})
