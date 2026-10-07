import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { excludedE2ETestPatterns } from '../scripts/e2eProjectScope.ts'
import { ensureIdeWarningReportEnv } from './utils/ideWarningReport.ts'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile.ts'

const DEVTOOLS_GLOBAL_SETUP = path.resolve(import.meta.dirname, './vitest.e2e.ide.global-setup.ts')
const DEVTOOLS_SETUP_FILE = path.resolve(import.meta.dirname, './vitest.e2e.ide.setup.ts')
const DOM_SETUP_FILE = path.resolve(import.meta.dirname, './vitest.e2e.dom.setup.ts')
const DOM_REPORTER = path.resolve(import.meta.dirname, './scripts/domAcceptanceReport/reporter.ts')

ensureIdeWarningReportEnv()

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ...excludedE2ETestPatterns()],
    // 参数化标题是 DOM 验收清单的 case 身份，必须保留完整名称。
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    include: resolveVitestIncludePatterns(import.meta.dirname, [
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ]),
    testTimeout: 36_000_000,
    // 真实 IDE teardown 需要等待窗口销毁证据与 utility backend 重启。
    hookTimeout: 120_000,
    globals: true,
    pool: 'threads',
    // 微信开发者工具的 renderer/compiler 进程不属于 Vitest worker 树；固定单 worker，避免窗口收尾期间叠加 IDE 会话耗尽宿主内存。
    maxWorkers: 1,
    fileParallelism: false,
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine.global-setup.ts'), DEVTOOLS_GLOBAL_SETUP],
    setupFiles: [DOM_SETUP_FILE, DEVTOOLS_SETUP_FILE],
    reporters: ['default', DOM_REPORTER],
  },
})
