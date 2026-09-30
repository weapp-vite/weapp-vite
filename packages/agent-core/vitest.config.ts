import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-agent/core', include: ['test/**/*.test.ts'] } })
