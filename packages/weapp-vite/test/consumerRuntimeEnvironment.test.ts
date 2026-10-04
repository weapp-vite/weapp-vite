import { describe, expect, it } from 'vitest'
import { createConsumerRuntimeEnvironment } from '../scripts/consumerRuntimeEnvironment.mjs'

describe('consumer runtime acceptance environment', () => {
  it('enables strict DOM acceptance for every published runtime invocation', () => {
    expect(createConsumerRuntimeEnvironment('headless', 'vite-plus', 'WEAPP_VITE_E2E_STATEFUL_PROJECT', '/consumer')).toEqual({
      WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
      WEAPP_VITE_E2E_COMPILER_HOST: 'vite-plus',
      WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1',
      WEAPP_VITE_E2E_STATEFUL_PROJECT: '/consumer',
    })
  })
})
