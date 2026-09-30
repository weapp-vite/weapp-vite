import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-agent/mini-program', include: ['test/**/*.test.ts'] } })
