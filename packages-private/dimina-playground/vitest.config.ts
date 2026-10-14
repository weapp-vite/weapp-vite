import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['scripts/**/*.test.ts', '../../e2e/dimina/diagnostics/*.test.ts'] } })
