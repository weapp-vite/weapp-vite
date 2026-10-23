import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertRetiredStatefulTransport, assertStylesheetClassic } from './stylesheet.mjs'

const endpointPath = '/__weapp_vite_stateful_hmr__'
const endpoint = new URL(endpointPath, 'http://localhost').href
const fallback = '[weapp-vite] HMR fallback {"from":"stateful-experimental","to":"classic","reason":"stylesheet-output","message":"compiled stylesheet changed","requested":"stateful-experimental","actual":"classic","phase":"switching"}\n'
const ready = '[weapp-vite] HMR classic ready {"reason":"stylesheet-output","requested":"stateful-experimental","actual":"classic","phase":"classic"}\n'
const cleanups: (() => Promise<unknown>)[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

async function fixture(operation = 'stateful-dev') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consumer-stylesheet-contract-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await writeFile(path.join(root, 'dist/app.js'), 'App({})')
  await writeFile(path.join(root, 'config-calls.txt'), 'loaded\n'.repeat(operation === 'stateful-dev' ? 2 : 1))
  await writeFile(path.join(root, 'project.private.config.json'), '{"setting":{"compileHotReLoad":false}}')
  return { root, operation, output: operation === 'stateful-dev' ? fallback + ready : '', endpoint }
}

function retiredResponse() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"type":"retired"}', { status: 410 }))
}

async function transport(status: number, body: string, location?: string) {
  const requests: { method: string | undefined, url: string | undefined }[] = []
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url })
    response.statusCode = status
    if (location) {
      response.setHeader('location', location)
    }
    response.end(body)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Transport fixture did not obtain a TCP address')
  }
  const close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  cleanups.push(() => server.listening ? close() : Promise.resolve())
  return { endpoint: `http://127.0.0.1:${address.port}${endpointPath}`, close, requests }
}

describe('packed consumer stylesheet classic evidence', () => {
  it('requires one classic handoff and keeps the same two config evaluations across later publications', async () => {
    const evidence = await fixture()
    const fetch = retiredResponse()
    for (const source of ['App({})', 'App({ changed: true })', 'App({})']) {
      await writeFile(path.join(evidence.root, 'dist/app.js'), source)
      await assertStylesheetClassic(evidence)
    }
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps classic dev at one config evaluation without a fallback', async () => {
    const evidence = await fixture('dev')
    const fetch = vi.spyOn(globalThis, 'fetch')
    await assertStylesheetClassic(evidence)
    expect(fetch).not.toHaveBeenCalled()
    await writeFile(path.join(evidence.root, 'config-calls.txt'), 'loaded\nloaded\n')
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow()
  })

  it.each([1, 3])('rejects %s config evaluations for a completed stateful handoff', async (count) => {
    const evidence = await fixture()
    retiredResponse()
    await writeFile(path.join(evidence.root, 'config-calls.txt'), 'loaded\n'.repeat(count))
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow()
  })

  it.each([
    ['missing decision', ready],
    ['missing readiness', fallback],
    ['repeated decision', fallback + fallback + ready],
    ['repeated readiness', fallback + ready + ready],
    ['wrong capability', (fallback + ready).replaceAll('stylesheet-output', 'config-json')],
    ['wrong effective mode', (fallback + ready).replace('"to":"classic"', '"to":"stateful-experimental"')],
    ['missing configured request', (fallback + ready).replaceAll(',"requested":"stateful-experimental"', '')],
    ['different configured request', (fallback + ready).replaceAll('"requested":"stateful-experimental"', '"requested":"auto"')],
    ['missing actual mode', (fallback + ready).replaceAll(',"actual":"classic"', '')],
    ['stateful actual mode', (fallback + ready).replaceAll('"actual":"classic"', '"actual":"stateful-experimental"')],
    ['missing phase', (fallback + ready).replace(/,"phase":"[^"]+"/g, '')],
    ['decision already ready', (fallback + ready).replace('"phase":"switching"', '"phase":"classic"')],
    ['readiness still switching', (fallback + ready).replaceAll('"phase":"classic"', '"phase":"switching"')],
    ['readiness with another request', fallback + ready.replace('"requested":"stateful-experimental"', '"requested":"auto"')],
    ['readiness before decision', ready + fallback],
    ['ordinary build error', `${fallback}${ready}Build failed\n`],
  ])('rejects two config evaluations with %s', async (_label, output) => {
    const evidence = await fixture()
    retiredResponse()
    await expect(assertStylesheetClassic({ ...evidence, output })).rejects.toThrow()
  })

  it('rejects classic readiness while the IDE script hot reload setting is still enabled', async () => {
    const evidence = await fixture()
    retiredResponse()
    await writeFile(path.join(evidence.root, 'project.private.config.json'), '{"setting":{"compileHotReLoad":true}}')
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow('Effective classic IDE mode')
  })

  it.each([WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE])('rejects stale stateful output %s', async (file) => {
    const evidence = await fixture()
    retiredResponse()
    const target = path.join(evidence.root, 'dist', file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, 'void 0;')
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow('Classic output must remove')
  })

  it.each([WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY])('rejects stateful client control remaining in any emitted script: %s', async (key) => {
    const evidence = await fixture()
    retiredResponse()
    await mkdir(path.join(evidence.root, 'dist/vendor'), { recursive: true })
    await writeFile(path.join(evidence.root, 'dist/vendor/runtime.js'), `globalThis[${JSON.stringify(key)}] = {}`)
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow(`must remove ${key}`)
  })

  it('does not accept an empty output directory as classic output', async () => {
    const evidence = await fixture()
    retiredResponse()
    await rm(path.join(evidence.root, 'dist/app.js'))
    await expect(assertStylesheetClassic(evidence)).rejects.toThrow('actual emitted JavaScript')
  })
})

describe('original stateful transport retirement', () => {
  it.each([
    [410, '{"type":"retired"}'],
    [404, '{"type":"not-found"}'],
    [404, ''],
    [404, `<!DOCTYPE html><html><body><pre>Cannot POST ${endpointPath}</pre></body></html>`],
  ])('accepts explicit %s retirement at the original endpoint', async (status, body) => {
    const server = await transport(status, body)
    await assertRetiredStatefulTransport(server.endpoint)
    expect(server.requests).toEqual([{ method: 'POST', url: endpointPath }])
  })

  it.each([
    [403, '{"type":"forbidden"}'],
    [200, '{"type":"registered"}'],
    [410, '{"type":"rebuilding"}'],
    [404, '{"type":"unrelated-page"}'],
    [404, '<html>Not found</html>'],
    [404, '<html><body><pre>Cannot POST /another-route</pre></body></html>'],
  ])('rejects active or unrelated responses: %s %s', async (status, body) => {
    const server = await transport(status, body)
    await expect(assertRetiredStatefulTransport(server.endpoint)).rejects.toThrow()
  })

  it('accepts connection refusal after the owned stateful listener has closed', async () => {
    const server = await transport(403, '{"type":"forbidden"}')
    await server.close()
    await assertRetiredStatefulTransport(server.endpoint)
  })

  it.each([307, 308])('rejects %s redirects to a different empty 404 endpoint', async (status) => {
    const destination = await transport(404, '')
    const server = await transport(status, '', destination.endpoint)
    await expect(assertRetiredStatefulTransport(server.endpoint)).rejects.toThrow()
    expect(server.requests).toEqual([{ method: 'POST', url: endpointPath }])
    expect(destination.requests).toEqual([])
  })

  it('rejects a redirect to a closed listener instead of treating it as retirement', async () => {
    const destination = await transport(403, '{"type":"forbidden"}')
    await destination.close()
    const server = await transport(307, '', destination.endpoint)
    await expect(assertRetiredStatefulTransport(server.endpoint)).rejects.toThrow()
    expect(server.requests).toEqual([{ method: 'POST', url: endpointPath }])
  })

  it('does not probe an unrelated route even when it would return 404', async () => {
    const server = await transport(404, '{"type":"not-found"}')
    await expect(assertRetiredStatefulTransport(new URL('/missing-page', server.endpoint).href)).rejects.toThrow('original stateful transport route')
    expect(server.requests).toEqual([])
  })

  it.each([
    new DOMException('request timed out', 'TimeoutError'),
    Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }),
    new TypeError('unrelated fetch failure'),
    new AggregateError([Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), Object.assign(new Error('permission denied'), { code: 'EPERM' })], 'mixed transport failures'),
  ])('preserves transport failures instead of treating them as retirement: %s', async (error) => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(error)
    await expect(assertRetiredStatefulTransport(endpoint)).rejects.toBe(error)
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
