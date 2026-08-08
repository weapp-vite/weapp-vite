import { WEVU_NATIVE_INSTANCE_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import {
  resolveSelectorQueryNativeScope,
  resolveSelectorQueryScopeId,
  setSelectorQueryScopeId,
} from './selectorQueryScope'

describe('selector query scope', () => {
  it('resolves a replaced native instance through the stable component scope id', () => {
    const staleNative = {}
    const currentNative = {}
    setSelectorQueryScopeId(staleNative, 'page:pages/index/index/component-card')
    setSelectorQueryScopeId(currentNative, 'page:pages/index/index/component-card')
    const publicProxy = {
      $state: {
        [WEVU_NATIVE_INSTANCE_KEY]: staleNative,
      },
    }

    expect(resolveSelectorQueryNativeScope(
      publicProxy,
      { route: 'pages/index/index' },
      [currentNative],
    )).toBe(currentNative)
    expect(resolveSelectorQueryScopeId(publicProxy)).toBe('page:pages/index/index/component-card')
  })
})
