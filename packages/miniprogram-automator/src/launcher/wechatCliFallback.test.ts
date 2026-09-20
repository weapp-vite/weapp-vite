import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutomatorViaHttp } from './wechatCliFallback'

const opaqueToken = 'a'.repeat(32)

describe('enableAutomatorViaHttp', () => {
  const options = {
    autoPort: 45678,
    projectPath: '/repo/demo app',
    servicePort: 20023,
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('uses the requested port for a DevTools opaque token response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(opaqueToken))))

    await expect(enableAutomatorViaHttp(options)).resolves.toBe(45678)
  })

  it.each([
    'a'.repeat(31),
    'a'.repeat(33),
    'g'.repeat(32),
  ])('rejects a string outside the opaque token protocol shape', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))))

    await expect(enableAutomatorViaHttp(options)).rejects.toThrow('unsupported response')
  })

  it('rejects an unknown successful response without disclosing its body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: opaqueToken }))))

    const error = await enableAutomatorViaHttp(options).catch(error => error) as Error & { cause?: unknown }

    expect(error.message).toBe('WeChat DevTools HTTP automator fallback returned unsupported response')
    expect(String(error)).not.toContain(opaqueToken)
    expect(error.cause).toBeUndefined()
  })

  it('surfaces DevTools HTTP errors without disclosing their body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(opaqueToken, { status: 400 })))

    const error = await enableAutomatorViaHttp(options).catch(error => error) as Error & { cause?: unknown }

    expect(error.message).toBe('WeChat DevTools HTTP automator fallback failed with status 400')
    expect(String(error)).not.toContain(opaqueToken)
    expect(error.cause).toBeUndefined()
  })

  it('rejects invalid JSON without retaining a body-bearing parse cause', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(opaqueToken)))

    const error = await enableAutomatorViaHttp(options).catch(error => error) as Error & { cause?: unknown }

    expect(error.message).toBe('WeChat DevTools HTTP automator fallback returned invalid JSON')
    expect(String(error)).not.toContain(opaqueToken)
    expect(error.cause).toBeUndefined()
  })

  it('rejects an invalid legacy port without disclosing its value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ autoPort: opaqueToken }))))

    const error = await enableAutomatorViaHttp(options).catch(error => error) as Error & { cause?: unknown }

    expect(error.message).toBe('WeChat DevTools HTTP automator fallback returned invalid autoPort')
    expect(String(error)).not.toContain(opaqueToken)
    expect(error.cause).toBeUndefined()
  })
})
