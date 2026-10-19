import { describe, expect, it } from 'vitest'
import { MANAGED_PROJECT_MAX_WINDOWS_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { getSuiteTasks } from '../e2e-suite-manifest'

describe('declared IDE task window budget', () => {
  it('declares two windows only for the two suites that require overlapping projects', async () => {
    const tasks = await getSuiteTasks('ide-full:exhaustive')
    const declared = tasks.filter(task => task.env?.[MANAGED_PROJECT_MAX_WINDOWS_ENV] !== undefined)
    expect(declared.map(task => task.label).sort()).toEqual([
      'ide/automator-concurrent-sessions.runtime.test.ts',
      'ide/devtools-shared-host.runtime.test.ts',
    ])
    for (const task of declared) {
      expect(task.env?.[MANAGED_PROJECT_MAX_WINDOWS_ENV]).toBe('2')
    }
  })
})
