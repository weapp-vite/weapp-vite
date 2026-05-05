import { describe, expect, it } from 'vitest'
import {
  applyWeappViteHostMeta,
  isWeappViteHost,
  resolveWeappViteHostMeta,
} from './pluginHost'

describe('plugin host metadata', () => {
  it('marks config as weapp-vite host', () => {
    const config = applyWeappViteHostMeta({}, 'miniprogram', 'alipay')

    expect(isWeappViteHost(config)).toBe(true)
    expect(resolveWeappViteHostMeta(config)).toEqual({
      name: 'weapp-vite',
      runtime: 'miniprogram',
      platform: 'alipay',
    })
  })

  it('marks web host metadata with web platform', () => {
    const config = applyWeappViteHostMeta({}, 'web', 'web')

    expect(resolveWeappViteHostMeta(config)).toEqual({
      name: 'weapp-vite',
      runtime: 'web',
      platform: 'web',
    })
  })

  it('returns undefined for ordinary vite config', () => {
    expect(isWeappViteHost({})).toBe(false)
    expect(resolveWeappViteHostMeta({
      weappVite: {
        name: 'vite',
        runtime: 'web',
      } as any,
    })).toBeUndefined()
  })
})
