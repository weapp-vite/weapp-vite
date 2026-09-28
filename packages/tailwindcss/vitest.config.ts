import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: '@weapp-vite/tailwindcss', include: ['src/**/*.test.ts'], testTimeout: 30000 } })
