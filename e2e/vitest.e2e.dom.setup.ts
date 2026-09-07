import { afterEach, beforeEach } from 'vitest'
import { isStrictDomAcceptance } from './scripts/domAcceptanceReport/helpers'
import { assertDomAcceptanceComplete } from './utils/domAcceptance/checkpoint'
import { flushRuntimeConsoleSessions } from './utils/runtimeConsoleSessions'
import './utils/domAcceptance'

beforeEach((context) => {
  delete context.task.meta.domAcceptance
})

afterEach(async (context) => {
  await flushRuntimeConsoleSessions()
  if (isStrictDomAcceptance()) {
    assertDomAcceptanceComplete(context.task.meta.domAcceptance)
  }
})
