import { describe, expect, it } from 'vitest'

describe('requestGlobals compatibility entry', () => {
  it('re-exports installRequestGlobals from @wevu/web-apis source package', async () => {
    const compatibility = await import('./requestGlobals')
    const webApis = await import('../../web-apis/src')

    expect(compatibility.installRequestGlobals).toBe(webApis.installRequestGlobals)
    expect(compatibility.installAbortGlobals).toBe(webApis.installAbortGlobals)
  })
})
