import type { TaskResourceReport } from './types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_MAX_WINDOWS_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { initializeManagedJournalScope } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'
import { createTaskResourceRecorder } from './index'

vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async importOriginal => ({
  ...await importOriginal<typeof import('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>(),
  readManagedWechatProjectRecords: async () => ['first-window', 'second-window'].map(id => ({
    id,
    createdAt: '2026-10-20T00:00:00.000Z',
    state: 'released',
    openedProjectWindow: true,
    releasedReason: 'project-closed',
    windowClose: { window: { nativeClosedAt: '2026-10-20T00:01:00.000Z', webContentsDestroyedAt: '2026-10-20T00:01:00.000Z' } },
  })),
}))

let directory: string
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'task-window-budget-'))
  await fs.mkdir(path.join(directory, 'journal'))
  await initializeManagedJournalScope(path.join(directory, 'journal'))
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('configured task resource window budget', () => {
  it.each([
    { taskBudget: '2', inheritedBudget: '1', expected: 2 },
    { taskBudget: undefined, inheritedBudget: undefined, expected: 1 },
    { taskBudget: '1', inheritedBudget: '2', expected: 1 },
  ])('retains declared budget $expected for task=$taskBudget and inherited=$inheritedBudget', async ({ taskBudget, inheritedBudget, expected }) => {
    vi.stubEnv(MANAGED_PROJECT_MAX_WINDOWS_ENV, inheritedBudget)
    const recorder = createTaskResourceRecorder({
      runId: 'window-budget',
      commitSha: 'a'.repeat(40),
      suiteName: 'budget-unit',
      taskLabel: 'declared-window-budget',
      taskIndex: 0,
      journalPath: path.join(directory, 'journal'),
      reportRoot: path.join(directory, 'reports'),
      env: taskBudget === undefined ? {} : { [MANAGED_PROJECT_MAX_WINDOWS_ENV]: taskBudget },
    })
    await recorder.initialize()
    const result = await recorder.finish({})
    expect(result.indexPath).toBeTypeOf('string')
    const report = JSON.parse(await fs.readFile(result.indexPath!, 'utf8')) as TaskResourceReport
    expect(report.windowUsage.managedBudget).toEqual({ status: 'observed', value: expected })
    // 两个意图确实重叠；配置预算不能从观测值推高。
    expect(report.windowUsage.traceDerivedManagedOverlapUpperBound).toEqual({ status: 'observed', value: 2 })
  })
})
