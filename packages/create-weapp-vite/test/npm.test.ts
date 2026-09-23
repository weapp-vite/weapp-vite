import type { RequestListener, Server } from 'node:http'
import type { RegistryOptions } from '../src/npm'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLatestVersionFromNpm, getPackageVersionsFromNpm, latestVersion } from '../src/npm'
import * as transport from '../src/npm/transport'

const servers: Server[] = []

async function registry(handler: RequestListener): Promise<RegistryOptions> {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('No listening address')
  }
  return { registry: `http://127.0.0.1:${address.port}/`, proxy: false, strictSSL: true }
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await Promise.all(servers.splice(0).map(async (server) => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }))
})

describe('registry metadata requests', () => {
  it('uses the scoped registry and path-bound authentication', async () => {
    let requestedPath = ''
    let authorization: string | undefined
    let accept: string | undefined
    const target = await registry((request, response) => {
      requestedPath = request.url ?? ''
      authorization = request.headers.authorization
      accept = request.headers.accept
      response.end(JSON.stringify({ versions: { '7.1.4': {}, '7.2.0': {} } }))
    })
    const scoped = `${target.registry}private/`
    const options: RegistryOptions = {
      ...target,
      'registry': 'https://unreachable.example/',
      '@weapp-vite:registry': scoped,
      [`//${new URL(scoped).host}/private/:_authToken`]: 'fixture-token',
    }
    await expect(getPackageVersionsFromNpm('@weapp-vite/dashboard', undefined, options)).resolves.toEqual(['7.1.4', '7.2.0'])
    expect(requestedPath).toBe('/private/%40weapp-vite%2Fdashboard')
    expect(authorization).toBe('Bearer fixture-token')
    expect(accept).toBe('application/vnd.npm.install-v1+json')
  })

  it('retries a transient response once and succeeds', async () => {
    let count = 0
    const options = await registry((_request, response) => {
      count++
      response.statusCode = count === 1 ? 503 : 200
      response.end(count === 1 ? '{}' : '{"version":"5.5.8"}')
    })
    await expect(getLatestVersionFromNpm('weapp-tailwindcss', undefined, options)).resolves.toBe('5.5.8')
    expect(count).toBe(2)
  })

  it.each([401, 403, 404])('does not retry HTTP %s or expose a response body', async (status) => {
    let count = 0
    const options = await registry((_request, response) => {
      count++
      response.statusCode = status
      response.end('{"error":"credential-secret"}')
    })
    const result = getPackageVersionsFromNpm('weapp-vite', undefined, options)
    await expect(result).rejects.toThrow(`HTTP ${status}`)
    await expect(result).rejects.not.toThrow('credential-secret')
    expect(count).toBe(1)
  })

  it('limits repeated transient errors to one retry', async () => {
    let count = 0
    const options = await registry((_request, response) => {
      count++
      response.statusCode = 503
      response.end('{}')
    })
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).rejects.toThrow('HTTP 503')
    expect(count).toBe(2)
  })

  it.each(['{invalid', 'null', '[]', '{}', '{"versions":[]}'])('rejects malformed metadata %s', async (body) => {
    const options = await registry((_request, response) => response.end(body))
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).rejects.toThrow()
  })

  it('does not send a token to another registry', async () => {
    let authorization: string | undefined
    const options = await registry((request, response) => {
      authorization = request.headers.authorization
      response.end('{"versions":{}}')
    })
    options['//private.example/:_authToken'] = 'fixture-token'
    await getPackageVersionsFromNpm('weapp-vite', undefined, options)
    expect(authorization).toBeUndefined()
  })

  it('routes metadata through the configured HTTP proxy', async () => {
    let requestedUrl = ''
    const proxy = await registry((request, response) => {
      requestedUrl = request.url ?? ''
      response.end('{"versions":{"7.2.0":{}}}')
    })
    const options: RegistryOptions = {
      registry: 'http://registry.example/',
      proxy: proxy.registry,
      noProxy: '',
      strictSSL: true,
    }
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).resolves.toEqual(['7.2.0'])
    expect(requestedUrl).toBe('http://registry.example/weapp-vite')
  })

  it('bypasses an unavailable proxy for a NO_PROXY host', async () => {
    const options = await registry((_request, response) => response.end('{"versions":{"7.2.0":{}}}'))
    options.proxy = 'http://unavailable-proxy.invalid:8080'
    options.noProxy = '127.0.0.1'
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).resolves.toEqual(['7.2.0'])
  })

  it.each(['port', 'hostname'])('rejects authenticated redirects to another %s before contacting the target', async (boundary) => {
    let requestCount = 0
    const target = await registry((request, response) => {
      requestCount++
      expect(request.headers.authorization).toBeUndefined()
      response.end('{"versions":{}}')
    })
    const options = await registry((_request, response) => {
      response.statusCode = 302
      response.setHeader('location', boundary === 'hostname' ? target.registry.replace('127.0.0.1', 'localhost') : target.registry)
      response.end()
    })
    options[`//${new URL(options.registry).host}/:_authToken`] = 'fixture-token'
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).rejects.toThrow('查询失败')
    expect(requestCount).toBe(0)
  })

  it('supports npm basic authentication on a direct registry request', async () => {
    let authorization: string | undefined
    const options = await registry((request, response) => {
      authorization = request.headers.authorization
      response.end('{"versions":{}}')
    })
    const host = new URL(options.registry).host
    options[`//${host}/:username`] = 'fixture-user'
    options[`//${host}/:_password`] = Buffer.from('fixture-password').toString('base64')
    await getPackageVersionsFromNpm('weapp-vite', undefined, options)
    expect(authorization).toBe(`Basic ${Buffer.from('fixture-user:fixture-password').toString('base64')}`)
  })

  it('follows public registry redirects without authentication', async () => {
    const target = await registry((_request, response) => response.end('{"versions":{"7.2.0":{}}}'))
    const options = await registry((_request, response) => {
      response.writeHead(302, { location: target.registry })
      response.end()
    })
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).resolves.toEqual(['7.2.0'])
  })

  it('rejects redirects when client certificate identity is configured', async () => {
    let requestCount = 0
    const options = await registry((_request, response) => {
      requestCount++
      response.writeHead(302, { location: '/redirected' })
      response.end()
    })
    // HTTP fixture 不执行 TLS 握手，仍能验证证书身份触发的重定向策略。
    options.cert = 'fixture-cert'
    options.key = 'fixture-key'
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, options)).rejects.toThrow('查询失败')
    expect(requestCount).toBe(1)
  })

  it('cancels a stalled response through the shared AbortSignal', async () => {
    const controller = new AbortController()
    const options = await registry((_request, response) => {
      response.write('{')
      controller.abort(new Error('private-token-do-not-log'))
    })
    const result = getPackageVersionsFromNpm('weapp-vite', controller.signal, options)
    await expect(result).rejects.toThrow('查询已取消')
    await expect(result).rejects.not.toThrow('private-token-do-not-log')
  })

  it('applies one total deadline across retries and streaming', async () => {
    vi.useFakeTimers()
    const fetch = vi.spyOn(transport, 'requestMetadata').mockImplementation(() => new Promise(() => {}))
    const options: RegistryOptions = { registry: 'https://registry.example/', strictSSL: true }
    const result = getPackageVersionsFromNpm('weapp-vite', undefined, options)
    const rejected = expect(result).rejects.toThrow('超过 5 秒')
    await vi.advanceTimersByTimeAsync(5_000)
    await rejected
    expect(fetch.mock.calls[0]?.[2].aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not request metadata for an already cancelled operation', async () => {
    const fetch = vi.spyOn(transport, 'requestMetadata')
    await expect(getPackageVersionsFromNpm('weapp-vite', AbortSignal.abort())).rejects.toThrow('查询已取消')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the latest-version helper signature and null fallback', async () => {
    await expect(latestVersion('example', '~', async () => '1.2.3')).resolves.toBe('~1.2.3')
    await expect(latestVersion('example', '^', async () => '')).resolves.toBeNull()
    await expect(latestVersion('example', '^', async () => {
      throw new Error('offline')
    })).resolves.toBeNull()
  })
})
