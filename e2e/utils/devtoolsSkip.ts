import type { RunnerTask, RunnerTestSuite } from 'vitest'
import process from 'node:process'

export const DEVTOOLS_SKIP_REASON_ENV = 'WEAPP_VITE_E2E_SKIP_DEVTOOLS_REASON'

export function getDevtoolsSkipReason(env = process.env) {
  return env[DEVTOOLS_SKIP_REASON_ENV] || ''
}

export function markSuiteSkipped(suite: RunnerTestSuite) {
  const tasks: RunnerTask[] = [suite]
  for (const task of tasks) {
    if (task.mode === 'run' || task.mode === 'queued') {
      task.mode = 'skip'
    }
    if (task.type === 'suite') {
      tasks.push(...task.tasks)
    }
  }
}
