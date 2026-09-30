import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-vite/acceptance', include: ['test/**/*.test.ts'] } })
