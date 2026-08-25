import { describe, expect, it, vi } from 'vitest'
import { enableAutomatorViaHttp } from './wechatCliFallback'

describe('enableAutomatorViaHttp', () => {
  const options = {
    autoPort: 45678,
    projectPath: '/repo/demo app',
    servicePort: 20023,
  }

  it('supports the legacy autoPort response and sends both port query names', async () => {
    const fetchMock = vi.fn(async (_input: string | URL) => new Response(JSON.stringify({ autoPort: 45679 })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(enableAutomatorViaHttp(options)).resolves.toBe(45679)

    const endpoint = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(Object.fromEntries(endpoint.searchParams)).toMatchObject({
      autoPort: '45678',
      port: '45678',
      project: '/repo/demo app',
    })
  })

  it.each(['s0', 's1'])('supports the new DevTools status response %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(status))))

    await expect(enableAutomatorViaHttp(options)).resolves.toBe(45678)
  })

  it('rejects an unknown successful response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }))))

    await expect(enableAutomatorViaHttp(options)).rejects.toThrow('unsupported response')
  })

  it('surfaces DevTools HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 31 }), { status: 400 })))

    await expect(enableAutomatorViaHttp(options)).rejects.toThrow('status 400')
  })
})
