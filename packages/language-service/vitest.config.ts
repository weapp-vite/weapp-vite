import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 包内脚本共用包配置，避免回溯到依赖 app 生成文件的根配置。
  tsconfig: path.resolve(import.meta.dirname, 'tsconfig.json'),
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
