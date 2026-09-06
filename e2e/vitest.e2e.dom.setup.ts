import { afterEach, beforeEach } from 'vitest'
import { isStrictDomAcceptance } from './scripts/domAcceptanceReport/helpers'
import { assertDomAcceptanceComplete } from './utils/domAcceptance/checkpoint'
import './utils/domAcceptance'

beforeEach((context) => {
  delete context.task.meta.domAcceptance
})

afterEach((context) => {
  if (isStrictDomAcceptance()) {
    assertDomAcceptanceComplete(context.task.meta.domAcceptance)
  }
})
