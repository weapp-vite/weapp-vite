import type { RunnerTestSuite } from 'vitest'
import process from 'node:process'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { cleanupOwnedDevtoolsProcesses, ensureDevtoolsProjectJournal } from './utils/devtoolsProcessOwnership'
import { getDevtoolsSkipReason, markSuiteSkipped } from './utils/devtoolsSkip'
import { registerIdeHmrCompanion } from './utils/ide-hmr-companion'
import { resolveRuntimeProviderName } from './utils/runtimeProvider'

let devtoolsJournalPath: string | undefined

beforeAll(async () => {
  if (resolveRuntimeProviderName() === 'devtools') {
    devtoolsJournalPath = await ensureDevtoolsProjectJournal()
  }
})

registerIdeHmrCompanion(() => Boolean(getDevtoolsSkipReason(process.env)))

beforeAll(function () {
  const skipReason = getDevtoolsSkipReason()
  // Vitest suite hook 的 suite 在运行时第二参数里；显式声明参数会触发 fixture 解析。
  // eslint-disable-next-line prefer-rest-params
  const suite = arguments[1] as RunnerTestSuite | undefined
  if (skipReason && suite) {
    markSuiteSkipped(suite)
  }
})

beforeEach((context) => {
  const skipReason = getDevtoolsSkipReason(process.env)
  if (skipReason) {
    context.skip(skipReason)
  }
})

afterAll(async () => {
  if (devtoolsJournalPath) {
    // IDE suites 串行；日志也包含本 worker 启动并已退出的 bridge CLI 所登记的窗口。
    await cleanupOwnedDevtoolsProcesses({ journalPath: devtoolsJournalPath, scope: 'journal' })
  }
}, 120_000)
