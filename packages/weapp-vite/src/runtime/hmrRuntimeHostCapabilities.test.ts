import { expect, it } from 'vitest'
import { resolveStatefulHmrStartupFallback } from './hmrRuntimeHostCapabilities'

it('rejects unconfirmed WeChat handoff capability before installing a stateful runtime', () => {
  expect(resolveStatefulHmrStartupFallback({ platform: 'weapp', runtime: 'stateful-experimental' })).toMatchObject({ code: 'ide-classic-handoff' })
  expect(resolveStatefulHmrStartupFallback({ platform: 'weapp', runtime: 'classic' })).toBeUndefined()
  expect(resolveStatefulHmrStartupFallback({ platform: 'alipay', runtime: 'stateful-experimental' })).toBeUndefined()
})
