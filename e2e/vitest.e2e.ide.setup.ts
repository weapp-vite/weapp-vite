import process from 'node:process'
import { beforeEach } from 'vitest'

const DEVTOOLS_SKIP_REASON_ENV = 'WEAPP_VITE_E2E_SKIP_DEVTOOLS_REASON'
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'

process.env[AUTOMATOR_LAUNCH_MODE_ENV] = 'bridge'
process.env[AUTOMATOR_SKIP_WARMUP_ENV] = '1'

beforeEach((context) => {
  const skipReason = process.env[DEVTOOLS_SKIP_REASON_ENV]
  if (skipReason) {
    context.skip(skipReason)
  }
})
