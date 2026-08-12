import { describe, expect, it } from 'vitest'
import { createWxssResolverPlugin } from './wxss'

describe('native style resolver', () => {
  it.each([
    ['/project/src/app.wxss', '/project/src/app.css?nativeStyle=wxss'],
    ['/project/src/app.acss', '/project/src/app.css?nativeStyle=acss'],
  ])('routes %s through the CSS pipeline', (source, expected) => {
    const plugin = createWxssResolverPlugin({
      ctx: {
        runtimeState: {},
      },
    } as any)
    const hook = plugin.resolveId as any

    expect(hook.filter.id.test(source)).toBe(true)
    expect(hook.handler(source)).toBe(expected)
  })
})
