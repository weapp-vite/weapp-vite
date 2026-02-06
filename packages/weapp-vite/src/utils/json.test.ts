import { describe, expect, it } from 'vitest'
import { resolveJson } from './json'

describe('utils/json resolveJson', () => {
  it('normalizes usingComponents keys for alipay platform', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            HelloWorld: '/components/HelloWorld/HelloWorld',
          },
        },
      },
      undefined,
      'alipay',
    )

    expect(source).toContain('"hello-world": "/components/HelloWorld/HelloWorld"')
    expect(source).not.toContain('"HelloWorld"')
  })

  it('keeps usingComponents keys for non-alipay platform', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            HelloWorld: '/components/HelloWorld/HelloWorld',
          },
        },
      },
      undefined,
      'weapp',
    )

    expect(source).toContain('"HelloWorld": "/components/HelloWorld/HelloWorld"')
  })

  it('rewrites dependency usingComponents paths for alipay with node_modules mode by default', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
            'LocalCard': '/components/LocalCard/index',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
      },
    )

    expect(source).toContain('"t-button": "/node_modules/tdesign-miniprogram/button/button"')
    expect(source).toContain('"local-card": "/components/LocalCard/index"')
  })

  it('supports miniprogram_npm mode for alipay dependency paths', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
        alipayNpmMode: 'miniprogram_npm',
      },
    )

    expect(source).toContain('"t-button": "/miniprogram_npm/tdesign-miniprogram/button/button"')
  })

  it('adds alipay default placeholder for boolean componentGenerics', () => {
    const source = resolveJson(
      {
        json: {
          componentGenerics: {
            'scoped-slots-items': true,
          },
        },
      },
      undefined,
      'alipay',
    )

    expect(source).toContain('"componentGenerics"')
    expect(source).toContain('"default": "./__weapp_vite_generic_component"')
  })
})
