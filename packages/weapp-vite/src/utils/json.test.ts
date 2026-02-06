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
})
