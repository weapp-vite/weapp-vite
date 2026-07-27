import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'

export default defineConfig({
  oxc: {
    // E2E 清单会直接导入 app 源码，不能依赖各 app 已生成 `.weapp-vite` tsconfig。
    tsconfig: false,
  },
  test: {
    include: [path.resolve(import.meta.dirname, './web-runtime/*.test.ts')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
