import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-agent/providers', include: ['test/**/*.test.ts'] } })
