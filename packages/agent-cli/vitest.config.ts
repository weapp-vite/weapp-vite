import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-agent/cli', include: ['src/**/*.test.ts', 'test/**/*.test.ts'] } })
