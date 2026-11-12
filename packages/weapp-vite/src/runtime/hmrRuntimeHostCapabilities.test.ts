import { expect, it } from 'vitest'
import { resolveStatefulHmrStartupFallback } from './hmrRuntimeHostCapabilities'

it('admits WeChat stateful startup while retaining the shared platform boundary', () => {
  expect(resolveStatefulHmrStartupFallback({ platform: 'weapp', runtime: 'stateful-experimental' })).toBeUndefined()
  expect(resolveStatefulHmrStartupFallback({ platform: 'weapp', runtime: 'classic' })).toBeUndefined()
  expect(resolveStatefulHmrStartupFallback({ platform: 'alipay', runtime: 'stateful-experimental' })).toMatchObject({ code: 'platform' })
})
