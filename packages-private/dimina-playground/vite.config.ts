import { defineConfig } from 'vite'
import { diminaResources } from './scripts/plugin'

export default defineConfig({
  base: '/dimina/',
  plugins: [diminaResources()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
