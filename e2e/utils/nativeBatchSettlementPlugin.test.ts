import type { Plugin } from 'vite'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { build, createServer } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { NATIVE_BATCH_SETTLEMENT_PREFIX, nativeBatchSettlementPlugin } from './nativeBatchSettlementPlugin'
import { captureNativePublication } from './nativePublication'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationHash } from './nativePublication/files'
import { nativePublicationPlugin } from './nativePublication/plugin'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
  vi.restoreAllMocks()
})

async function createBridge(options: { stateful?: boolean, observer?: Plugin, input?: PassThrough, output?: PassThrough } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'native-batch-settlement-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const input = options.input ?? new PassThrough()
  const output = options.output ?? new PassThrough()
  const called = Promise.withResolvers<void>()
  const settled = Promise.withResolvers<void>()
  const whenSettled = vi.fn(() => {
    called.resolve()
    return settled.promise
  })
  const observer = options.observer ?? nativeBatchSettlementPlugin({ input, output })
  const before = input.listenerCount('data')
  const server = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [
      ...(options.stateful === false ? [] : [{ name: 'weapp-vite:stateful-hmr-session', api: { whenSettled } }]),
      observer,
    ],
    server: { middlewareMode: true, watch: null, hmr: false },
  })
  cleanups.push(async () => {
    await server.close()
    input.destroy()
    output.destroy()
  })
  const responses: string[] = []
  output.on('data', chunk => responses.push(String(chunk)))
  const request = (id: string) => input.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify({ id })}\n`)
  return { root, observer, input, output, called, settled, whenSettled, before, server, responses, request }
}

it('does not acknowledge an active owner and carries the request identity only after settlement', async () => {
  const bridge = await createBridge()
  bridge.request('restoration-generation')
  await bridge.called.promise
  expect(bridge.whenSettled).toHaveBeenCalledTimes(1)
  expect(bridge.responses).toEqual([])
  const response = once(bridge.output, 'data')
  bridge.settled.resolve()
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"restoration-generation","status":"complete"}\n`])
})

it('reports an owner rejection as failed rather than acknowledging readable output', async () => {
  const bridge = await createBridge()
  bridge.request('failed-publication')
  await bridge.called.promise
  const response = once(bridge.output, 'data')
  bridge.settled.reject(new Error('publication cleanup failed'))
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"failed-publication","status":"failed","error":"publication cleanup failed"}\n`])
})

it('removes input listeners on host close and cannot emit a late success for that host', async () => {
  const bridge = await createBridge()
  bridge.request('closing-generation')
  await bridge.called.promise
  await bridge.server.close()
  expect(bridge.input.listenerCount('data')).toBe(bridge.before)
  bridge.request('next-generation')
  expect(bridge.whenSettled).toHaveBeenCalledTimes(1)
  const response = once(bridge.output, 'data')
  bridge.settled.resolve()
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"closing-generation","status":"failed","error":"Native batch settlement observer closed before acknowledgement"}\n`])
  await bridge.server.close()
  expect(bridge.input.listenerCount('data')).toBe(bridge.before)
})

it('does not invoke the owner for malformed fixture requests', async () => {
  const bridge = await createBridge()
  const response = once(bridge.output, 'data')
  bridge.input.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":42}\n`)
  await response
  expect(bridge.whenSettled).not.toHaveBeenCalled()
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"status":"failed","error":"Invalid native batch settlement request"}\n`])
})

it('leaves classic settlement unacknowledged while retaining actual native publication validation', async () => {
  const bridge = await createBridge({ stateful: false })
  expect(bridge.input.listenerCount('data')).toBe(bridge.before)
  bridge.request('classic-cannot-settle-stateful')
  expect(bridge.responses).toEqual([])
  expect(bridge.whenSettled).not.toHaveBeenCalled()

  await mkdir(path.join(bridge.root, 'src'))
  const source = 'console.info("native classic publication")'
  await writeFile(path.join(bridge.root, 'src/app.js'), source)
  let output = ''
  const write = process.stdout.write.bind(process.stdout)
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (write as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const publication = captureNativePublication({ getOutput: () => output, waitFor: async task => await task }, bridge.root)
  await build({
    root: bridge.root,
    configFile: false,
    logLevel: 'silent',
    plugins: [bridge.observer, nativePublicationPlugin()],
    build: { minify: false, rolldownOptions: { input: path.join(bridge.root, 'src/app.js'), output: { entryFileNames: 'app.js' } } },
  })
  const receipt = await publication.wait()
  expect(receipt.boundary).toBe('native-byte-write')
  expect(receipt.inputs['src/app.js']).toBe(nativePublicationHash(source))
  expect(receipt.outputs['app.js']).toBe(nativePublicationHash(await readFile(path.join(bridge.root, 'dist/app.js'))))
  expect(bridge.responses).toEqual([])
})

it('reuses the observer across a stateful host close and classic replacement without borrowing the old owner', async () => {
  const previous = await createBridge()
  previous.request('old-generation')
  await previous.called.promise
  await previous.server.close()
  const response = once(previous.output, 'data')
  previous.settled.resolve()
  await response
  const oldResponses = [...previous.responses]
  const replacement = await createBridge({ stateful: false, observer: previous.observer, input: previous.input, output: previous.output })
  expect(replacement.input.listenerCount('data')).toBe(previous.before)
  replacement.request('replacement-generation')
  expect(previous.whenSettled).toHaveBeenCalledTimes(1)
  expect(replacement.whenSettled).not.toHaveBeenCalled()
  expect(previous.responses).toEqual(oldResponses)
  expect(replacement.responses).toEqual([])
  await previous.server.close()
  await replacement.server.close()
  expect(replacement.input.listenerCount('data')).toBe(previous.before)
})

it('still rejects a declared stateful owner with a missing settlement API before attaching input listeners', () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const observer = nativeBatchSettlementPlugin({ input, output })
  const configure = observer.configureServer as (server: unknown) => void
  const close = vi.fn()
  expect(() => configure({ config: { plugins: [{ name: 'weapp-vite:stateful-hmr-session', api: {} }] }, close })).toThrow('Native batch observation requires the stateful session settlement API')
  expect(input.listenerCount('data')).toBe(0)
  expect(output.readableLength).toBe(0)
  expect(close).not.toHaveBeenCalled()
  input.destroy()
  output.destroy()
})
