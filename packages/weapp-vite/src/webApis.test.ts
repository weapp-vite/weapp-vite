import { describe, expect, it } from 'vitest'

describe('web-apis compatibility entry', () => {
  it('re-exports installRequestGlobals from @wevu/web-apis', async () => {
    const compatibility = await import('./webApis')
    const webApis = await import('@wevu/web-apis')

    expect(compatibility.installRequestGlobals).toBe(webApis.installRequestGlobals)
    expect(compatibility.installAbortGlobals).toBe(webApis.installAbortGlobals)
  })
})
