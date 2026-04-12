import { describe, expect, it, vi } from 'vitest'

const installWebRuntimeGlobalsMock = vi.fn()
const installRequestGlobalsMock = vi.fn()
const installAbortGlobalsMock = vi.fn()

vi.mock('@wevu/web-apis', () => ({
  installWebRuntimeGlobals: installWebRuntimeGlobalsMock,
  installRequestGlobals: installRequestGlobalsMock,
  installAbortGlobals: installAbortGlobalsMock,
}))

describe('web-apis compatibility entry', () => {
  it('re-exports installWebRuntimeGlobals from @wevu/web-apis and keeps request alias', async () => {
    const compatibility = await import('./webApis')

    expect(compatibility.installWebRuntimeGlobals).toBe(installWebRuntimeGlobalsMock)
    expect(compatibility.installRequestGlobals).toBe(installRequestGlobalsMock)
    expect(compatibility.installAbortGlobals).toBe(installAbortGlobalsMock)
  })
})
