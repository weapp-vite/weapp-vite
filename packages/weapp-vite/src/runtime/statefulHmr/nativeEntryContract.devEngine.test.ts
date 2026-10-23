import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RolldownOutput } from 'rolldown'
import type { ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { createContext, runInContext } from 'node:vm'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import path from 'pathe'
import { dev } from 'rolldown/experimental'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrHostFormatPlugin } from './hostFormat'
import { registerStatefulHmrInitialChunkLoaders } from './initialChunkLoaders'
import { protectStatefulHmrNativeEntries } from './nativeEntryContract'
import { transformStatefulHmrOutput } from './outputTransform'
import { writeStatefulHmrOutput } from './outputWriter'
import { createStatefulHmrControlSource } from './runtimeSource'
import { stampStatefulHmrFullBuild } from './session'
import { StatefulHmrTransport } from './transport'
import { createStatefulHmrBanner, createStatefulHmrFooter } from './viteAdapter'

const nativeEntry = 'pages/native/index.js'
type RequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>
interface ClientRequest {
  data: { action: string, version: number, failure?: { reason: string } }
  success: (result: { statusCode: number, data: { type: string, ready?: boolean } }) => void
}

async function buildNativeEntryFiles(): Promise<Map<string, string>> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-entry-contract-')))
  try {
    const appSource = path.join(root, 'app.js')
    const pageSource = path.join(root, 'page.js')
    await Promise.all([
      writeFile(appSource, `import { marker } from './dependency.js';
        globalThis.appExecutions++;
        globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].App({ marker });`),
      writeFile(pageSource, `import { marker } from './dependency.js';
        globalThis.bodyExecutions++;
        if (globalThis.businessFailure) throw globalThis.businessFailure;
        globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Page({ data: { marker } });
        import.meta.hot.accept();`),
      writeFile(path.join(root, 'dependency.js'), 'globalThis.dependencyExecutions++; export const marker = "native-entry";'),
    ])
    const outputs: RolldownOutput[] = []
    let outputError: Error | undefined
    const engine = await dev({
      cwd: root,
      input: { 'app': appSource, 'pages/native/index': pageSource },
      experimental: { devMode: { lazy: false, skipCommonRuntimeInjection: true, implement: createStatefulHmrRolldownRuntimeSource() } },
      plugins: [createStatefulHmrHostFormatPlugin()],
    }, {
      format: 'esm',
      entryFileNames: '[name].js',
      banner: createStatefulHmrBanner,
      footer: createStatefulHmrFooter,
    }, {
      watch: { skipWrite: true },
      onOutput(output) {
        if (output instanceof Error) {
          outputError = output
        }
        else { outputs.push(output) }
      },
    })
    const running = engine.run()
    try {
      await engine.registerClient('native-entry-contract')
      await engine.ensureCurrentBuildFinish()
      await engine.getBundleState()
      if (outputError) {
        throw outputError
      }
      const output = outputs.at(-1)
      if (!output) {
        throw new Error('The real DevEngine did not publish initial output')
      }
      const transformed = await transformStatefulHmrOutput([
        ...output.output,
        // 独立 DevEngine fixture 没有宿主的 runtime 文件发射层，使用同一真实源码补齐原生入口依赖。
        ...(output.output.some(item => item.fileName === 'rolldown-runtime.js')
          ? []
          : [{ type: 'asset' as const, fileName: 'rolldown-runtime.js', source: createStatefulHmrRolldownRuntimeSource() }]),
      ], false)
      registerStatefulHmrInitialChunkLoaders(transformed, [])
      stampStatefulHmrFullBuild(transformed, 'native-entry-build')
      protectStatefulHmrNativeEntries(transformed)
      const outDir = path.join(root, 'dist')
      await writeStatefulHmrOutput(outDir, transformed)
      return new Map(await Promise.all(transformed.filter(item => item.fileName.endsWith('.js'))
        .map(async item => [item.fileName, await readFile(path.join(outDir, item.fileName), 'utf8')] as const)))
    }
    finally {
      await engine.close()
      await running
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

function createNativeHost(emittedFiles: Map<string, string>) {
  const files = new Map(emittedFiles)
  const events: string[] = []
  const requests: ClientRequest[] = []
  const requestClassic = vi.fn()
  const requestFullBuild = vi.fn()
  const reportError = vi.fn()
  const use = vi.fn<(route: string, handler: RequestHandler) => void>()
  const transport = new StatefulHmrTransport({
    middlewares: { use },
    config: { server: { port: 0 }, logger: { warn: vi.fn(), error: vi.fn() } },
  } as unknown as ViteDevServer, async () => {}, requestFullBuild, requestClassic, reportError)
  transport.install()
  const control = transport.createControl()
  files.set(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, createStatefulHmrControlSource(control))
  files.set(WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'void 0;')
  files.set(WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'void 0;')
  const context = createContext({
    console: { warn: vi.fn(), error: vi.fn() },
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
    appExecutions: 0,
    bodyExecutions: 0,
    dependencyExecutions: 0,
    App: vi.fn(),
    Page: vi.fn(),
    Component: vi.fn(),
    wx: {
      request(options: ClientRequest) {
        events.push(`request:${options.data.action}`)
        requests.push(options)
        return { abort: vi.fn() }
      },
    },
  })
  const loaded = new Map<string, { exports: unknown }>()
  function requireFile(name: string): unknown {
    if (loaded.has(name)) {
      return loaded.get(name)!.exports
    }
    const code = files.get(name)
    if (code === undefined) {
      throw new Error(`Missing emitted module: ${name}`)
    }
    events.push(`load:${name}`)
    const module = { exports: {} }
    loaded.set(name, module)
    const localRequire = (id: string) => requireFile(path.posix.normalize(path.posix.join(path.posix.dirname(name), id)))
    try {
      const execute = runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: name })
      execute(localRequire, module, module.exports)
      return module.exports
    }
    catch (error) {
      loaded.delete(name)
      throw error
    }
  }
  requireFile('app.js')
  requests[0]!.success({ statusCode: 200, data: { type: 'registered', ready: true } })
  const client = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
  return {
    context,
    client,
    files,
    loaded,
    events,
    requests,
    requestClassic,
    requestFullBuild,
    reportError,
    loadPage: () => requireFile(nativeEntry),
    async dispatch(request: ClientRequest) {
      const incoming = Object.assign(Readable.from([Buffer.from(JSON.stringify(request.data))]), { method: 'POST' })
      const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }
      await use.mock.calls[0]![1](incoming as IncomingMessage, response as unknown as ServerResponse)
    },
    close() {
      client.stop()
      transport.close()
    },
  }
}

describe('native entry capability contract in final DevEngine CJS output', () => {
  let emittedFiles: Map<string, string>
  beforeAll(async () => {
    emittedFiles = await buildNativeEntryFiles()
  }, 20_000)

  it('executes the real entry and registers a native page when its runtime contract is ready', () => {
    const host = createNativeHost(emittedFiles)
    try {
      host.loadPage()
      expect(host.context.bodyExecutions).toBe(1)
      expect(host.context.dependencyExecutions).toBe(1)
      expect(host.context.App).toHaveBeenCalledOnce()
      expect(host.context.Page).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: { marker: 'native-entry' } }))
      expect(host.client.getVersion()).toBe(0)
      expect(host.requests.filter(request => request.data.action === 'rebuild')).toEqual([])
    }
    finally { host.close() }
  })

  it('reports runtime-contract before replaying an unchanged native entry with cached runtime/control and a deleted bridge', async () => {
    const host = createNativeHost(emittedFiles)
    try {
      host.loadPage()
      const originalBytes = host.files.get(nativeEntry)
      const retained = new Map([...host.loaded].filter(([name]) => name === 'rolldown-runtime.js' || name === WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE))
      expect(retained.size).toBe(2)
      for (const name of host.loaded.keys()) {
        if (!retained.has(name)) {
          host.loaded.delete(name)
        }
      }
      expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, host.context)).toBe(true)
      expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, host.context)).toBe(false)
      host.events.length = 0
      let thrown: unknown
      try {
        host.loadPage()
      }
      catch (error) {
        thrown = error
      }
      const rebuilds = host.requests.filter(request => request.data.action === 'rebuild')
      expect.soft(rebuilds).toHaveLength(1)
      expect.soft(thrown).toBeUndefined()
      expect.soft(host.events).toEqual([`load:${nativeEntry}`, 'request:rebuild'])
      expect(host.files.get(nativeEntry)).toBe(originalBytes)
      expect(host.context.bodyExecutions).toBe(1)
      expect(host.context.dependencyExecutions).toBe(1)
      expect(host.context.Page).toHaveBeenCalledOnce()
      expect(host.client.getVersion()).toBe(0)
      expect(host.context[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]).toBeUndefined()
      for (const [name, module] of retained) {
        expect(host.loaded.get(name)).toBe(module)
      }
      host.loaded.delete(nativeEntry)
      expect(() => host.loadPage()).not.toThrow()
      expect(host.requests.filter(request => request.data.action === 'rebuild')).toHaveLength(1)
      expect(host.events).toEqual([`load:${nativeEntry}`, 'request:rebuild', `load:${nativeEntry}`])
      expect(host.context.bodyExecutions).toBe(1)
      expect(host.context.Page).toHaveBeenCalledOnce()
      if (!rebuilds[0]) {
        throw new Error('The unchanged native entry did not report its missing runtime contract')
      }
      expect(rebuilds[0].data).toMatchObject({ action: 'rebuild', version: 0, failure: { reason: 'bridge-not-ready' } })
      await host.dispatch(rebuilds[0])
      expect(host.requestClassic).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'runtime-contract' }))
      expect(host.requestFullBuild).not.toHaveBeenCalled()
      expect(host.reportError).not.toHaveBeenCalled()
    }
    finally { host.close() }
  })

  it('preserves a business exception from a healthy entry without requesting a classic fallback', () => {
    const host = createNativeHost(emittedFiles)
    const failure = new Error('native page business failure')
    host.context.businessFailure = failure
    try {
      let thrown: unknown
      try {
        host.loadPage()
      }
      catch (error) {
        thrown = error
      }
      expect(thrown).toBe(failure)
      expect(host.context.bodyExecutions).toBe(1)
      expect(host.context.Page).not.toHaveBeenCalled()
      expect(host.requests.filter(request => request.data.action === 'rebuild')).toEqual([])
      expect(host.requestClassic).not.toHaveBeenCalled()
      expect(host.client.getVersion()).toBe(0)
    }
    finally { host.close() }
  })
})
