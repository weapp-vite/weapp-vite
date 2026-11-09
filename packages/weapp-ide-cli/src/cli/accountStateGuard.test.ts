import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { assertDevtoolsAccountStatePreserved } from './accountStateGuard'

describe('managed IDE E2E account state guard', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['logout'],
    ['log-out'],
    ['signout'],
    ['sign-out'],
    ['account', 'logout'],
    ['auth', 'sign-out'],
    ['login', '--logout'],
    ['cache', '--clean', 'all'],
    ['cache', '--clean=auth'],
    ['cache', '-c', 'session'],
  ])('blocks account-state cleanup for %j', (...argv) => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, 'managed-task-journal')

    expect(() => assertDevtoolsAccountStatePreserved(argv)).toThrow('DEVTOOLS_ACCOUNT_STATE_PROTECTED')
  })

  it.each([
    ['quit'],
    ['cache', '--clean', 'compile'],
    ['cache', '--clean', 'storage'],
  ])('allows unrelated IDE commands for %j', (...argv) => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, 'managed-task-journal')

    expect(() => assertDevtoolsAccountStatePreserved(argv)).not.toThrow()
  })

  it('only protects account state in a managed IDE E2E scope', () => {
    expect(() => assertDevtoolsAccountStatePreserved(['cache', '--clean', 'auth'])).not.toThrow()
  })
})
