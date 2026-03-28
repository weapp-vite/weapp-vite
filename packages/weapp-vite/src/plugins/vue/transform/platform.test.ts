import { describe, expect, it } from 'vitest'
import { resolveVueTransformJsonPlatformOptions } from './platform'

describe('vue transform platform helpers', () => {
  it('resolves json normalization options from config service', () => {
    expect(resolveVueTransformJsonPlatformOptions()).toEqual({
      platform: 'weapp',
      normalizeUsingComponents: false,
      dependencies: undefined,
      alipayNpmMode: undefined,
    })

    expect(resolveVueTransformJsonPlatformOptions({
      platform: 'alipay',
      packageJson: {
        dependencies: {
          dayjs: '^1.11.0',
        },
      },
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'node_modules',
        },
      },
    } as any)).toEqual({
      platform: 'alipay',
      normalizeUsingComponents: true,
      dependencies: {
        dayjs: '^1.11.0',
      },
      alipayNpmMode: 'node_modules',
    })
  })
})
