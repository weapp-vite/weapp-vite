import { defineConfig } from 'vitest/config'
import { workspaceSourceAliases } from './scripts/workspaceSourceAliases.ts'

export default defineConfig({
  resolve: {
    alias: Object.entries(workspaceSourceAliases).map(([specifier, replacement]) => ({
      find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'u'),
      replacement,
    })),
  },
  test: {
    include: ['extension/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
