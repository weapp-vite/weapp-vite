import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { ensureIdeWarningReportEnv } from './utils/ideWarningReport.ts'
import { resolveE2EMaxWorkers } from './utils/max-workers.ts'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile.ts'

ensureIdeWarningReportEnv()

export default defineConfig({
  test: {
    // 与真实 IDE 使用相同的完整 case 名称，避免验收清单身份漂移。
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    include: resolveVitestIncludePatterns(import.meta.dirname, [
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ]),
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
    setupFiles: [path.resolve(import.meta.dirname, './vitest.e2e.dom.setup.ts')],
    reporters: ['default', path.resolve(import.meta.dirname, './scripts/domAcceptanceReport/reporter.ts')],
  },
})
