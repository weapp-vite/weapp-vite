import { describe, expect, it } from 'vitest'
import { rewriteMiniProgramPlatformApiAccess } from './platformApiRewrite'

describe('rewriteMiniProgramPlatformApiAccess', () => {
  it('rewrites free mini-program globals to the injected api alias', () => {
    const code = rewriteMiniProgramPlatformApiAccess(
      'export const run = () => wx.showToast({ title: "ok" }) && my.alert({ content: "done" })',
      'weapi',
    )

    expect(code).toContain('var __weappViteInjectedApi__ = ')
    expect(code).toContain('["weapi"]')
    expect(code).toContain('__weappViteInjectedApi__.showToast')
    expect(code).toContain('__weappViteInjectedApi__.alert')
  })

  it('keeps locally shadowed globals untouched', () => {
    const source = 'const wx = createMock(); export const run = () => wx.showToast({ title: "ok" })'
    expect(rewriteMiniProgramPlatformApiAccess(source, 'wpi')).toBe(source)
  })
})
