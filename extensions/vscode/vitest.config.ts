import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { workspaceSourceAliases } from './scripts/workspaceSourceAliases.ts'

export default defineConfig({
  // 导入的配置和跨包源码都归此测试项目转换，避免遍历根 solution 的应用引用。
  tsconfig: path.resolve(import.meta.dirname, 'tsconfig.json'),
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
