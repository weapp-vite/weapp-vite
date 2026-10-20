import { expect, it } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/index'
import { workerEnvironment } from './supervisor.mjs'

it('isolates ordinary workers from the real IDE journal without mutating the inherited environment', () => {
  const inherited = { [MANAGED_PROJECT_JOURNAL_ENV]: 'active-ide-journal', OTHER_SETTING: 'preserved' }
  const scope = { CONTRACT_SCOPE: 'derived-machine-scope' }
  const environment = workerEnvironment(scope, inherited)
  expect(environment).toEqual({ OTHER_SETTING: 'preserved', CONTRACT_SCOPE: 'derived-machine-scope' })
  expect(inherited).toEqual({ [MANAGED_PROJECT_JOURNAL_ENV]: 'active-ide-journal', OTHER_SETTING: 'preserved' })
  expect(scope).toEqual({ CONTRACT_SCOPE: 'derived-machine-scope' })
})
