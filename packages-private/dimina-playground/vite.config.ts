import { defineConfig } from 'vite'
import { hostDiagnostics } from '../../e2e/dimina/diagnostics/host'
import { diminaResources } from './scripts/plugin'

export default defineConfig({
  base: '/dimina/',
  plugins: [diminaResources(), hostDiagnostics()],
  server: {
    host: '127.0.0.1',
    watch: { ignored: ['**/.cache/**', '**/.weapp-vite/**'] },
  },
  preview: { host: '127.0.0.1' },
})
