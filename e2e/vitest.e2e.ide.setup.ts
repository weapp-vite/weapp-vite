import process from 'node:process'
import { beforeEach } from 'vitest'

const DEVTOOLS_SKIP_REASON_ENV = 'WEAPP_VITE_E2E_SKIP_DEVTOOLS_REASON'

beforeEach((context) => {
  const skipReason = process.env[DEVTOOLS_SKIP_REASON_ENV]
  if (skipReason) {
    context.skip(skipReason)
  }
})
