import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let gitHash = 'unknown'
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Could not get git hash:', e.message)
}

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
