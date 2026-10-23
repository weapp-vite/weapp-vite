import type { OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../context'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { build } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { protectClassicHandoffEntries } from './classicEntryContract'
import { createOutputPublicationPlugin } from './publication'

async function buildClassicEntries(fallback: boolean) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-classic-entry-contract-'))
  const ctx = {
    runtimeState: createRuntimeState(),
    scanService: { independentSubPackageMap: new Map() },
    configService: {
      cwd: root,
      isDev: true,
      platform: 'weapp',
      multiPlatform: { enabled: false },
      weappViteConfig: { hmr: { runtime: fallback ? 'auto' : 'classic' } },
    },
  } as unknown as CompilerContext
  if (fallback) {
    getHmrRuntimeSession(ctx).requestClassic({ code: 'runtime-contract', message: 'fixture missing runtime contract' })
  }
  try {
    const sources = new Map([
      ['virtual:app', 'import { installWebRuntimeGlobals } from "virtual:runtime"; installWebRuntimeGlobals(); App({ marker: "classic-app" });'],
      ['virtual:page', 'import { installWebRuntimeGlobals } from "virtual:runtime"; installWebRuntimeGlobals(); if (globalThis.businessFailure) throw globalThis.businessFailure; Page({ data: { marker: "classic-page" } });'],
      ['virtual:runtime', 'export function installWebRuntimeGlobals() { globalThis.installations++; }'],
    ])
    const result = await build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      plugins: [{ name: 'classic-entry-contract-fixture', resolveId: id => sources.has(id) ? id : undefined, load: id => sources.get(id) }, createOutputPublicationPlugin(ctx)],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        minify: false,
        sourcemap: true,
        rolldownOptions: {
          input: { app: 'virtual:app', page: 'virtual:page', runtime: 'virtual:runtime' },
          preserveEntrySignatures: 'strict',
          output: { format: 'cjs', entryFileNames: '[name].js' },
        },
      },
    })
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected native classic output')
    }
    const chunks = result.output.filter((item): item is OutputChunk => item.type === 'chunk')
    const files = new Map(await Promise.all((await readdir(path.join(root, 'dist'))).filter(name => name.endsWith('.js') || name.endsWith('.map'))
      .map(async name => [name, await readFile(path.join(root, 'dist', name), 'utf8')] as const)))
    return { files, chunks }
  }
  finally {
    await getHmrRuntimeSession(ctx).classicIdeConfig.close()
    await rm(root, { recursive: true, force: true })
  }
}

function createHost(files: Map<string, string>, oldClient?: object, staleRuntime = false) {
  const cache = new Map<string, { exports: unknown }>()
  // stateful 的宿主 CJS 缓存与 DevEngine module registry 分离；此处只重现不兼容的宿主缓存边界。
  if (staleRuntime) {
    cache.set('runtime.js', { exports: {} })
  }
  const dependencies: string[] = []
  const context = createContext({
    ...(oldClient ? { [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]: oldClient } : {}),
    installations: 0,
    App: vi.fn(),
    Page: vi.fn(),
  })
  function load(file: string): unknown {
    if (cache.has(file)) {
      return cache.get(file)!.exports
    }
    const module = { exports: {} }
    cache.set(file, module)
    const require = (id: string) => {
      dependencies.push(id)
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)))
    }
    try {
      runInContext(`(function(require,module,exports){${files.get(file)}\n})`, context, { filename: file })(require, module, module.exports)
      return module.exports
    }
    catch (error) {
      cache.delete(file)
      throw error
    }
  }
  return { context, cache, dependencies, load }
}

describe('classic handoff entry boundary in native output', () => {
  it('is idempotent, preserves CommonJS lexical bindings and leaves shared modules alone', () => {
    const entry = { type: 'chunk', fileName: 'app.js', isEntry: true, code: 'exports.thisValue = this; exports.argumentValue = arguments[2]; exports.strictThis = (function () { return this; })(); module.exports.result = "classic-exports";' } as OutputChunk
    const shared = { type: 'chunk', fileName: 'shared.js', isEntry: false, code: 'exports.shared = true;' } as OutputChunk
    protectClassicHandoffEntries({ 'app.js': entry, 'shared.js': shared })
    const first = entry.code
    protectClassicHandoffEntries({ 'app.js': entry })
    expect(entry.code).toBe(first)
    expect(shared.code).toBe('exports.shared = true;')
    const exports: Record<string, unknown> = {}
    runInContext(`(function(require,module,exports){${entry.code}\n})`, createContext({})).call(exports, () => {}, { exports }, exports)
    expect(exports.thisValue).toBe(exports)
    expect(exports.argumentValue).toBe(exports)
    expect(exports.strictThis).toBeUndefined()
    expect(exports.result).toBe('classic-exports')
  })

  it('composes the final guard with existing source mappings', () => {
    const source = 'exports.marker = "mapped-classic";'
    const entry = { type: 'chunk', fileName: 'page.js', isEntry: true, code: source, map: new MagicString(source).generateMap({ source: 'original-page.ts', includeContent: true, hires: true }) } as unknown as OutputChunk
    protectClassicHandoffEntries({ 'page.js': entry })
    const lines = entry.code.split('\n')
    const line = lines.findIndex(value => value.includes('exports.marker'))
    expect(originalPositionFor(new TraceMap(entry.map as any), { line: line + 1, column: lines[line]!.indexOf('exports.marker') }))
      .toMatchObject({ source: 'original-page.ts', line: 1, column: 0 })
  })

  it('reproduces an unprotected classic entry consuming an incompatible stateful CommonJS cache', async () => {
    const { files } = await buildClassicEntries(false)
    const host = createHost(files, {}, true)
    expect(() => host.load('page.js')).toThrow(/installWebRuntimeGlobals.*not a function/)
    expect(host.dependencies).not.toHaveLength(0)
    expect(host.context.Page).not.toHaveBeenCalled()
  })

  it.each(['polling', 'stopped'])('waits for the fresh realm before executing classic entry dependencies: %s old client', async (phase) => {
    const { files } = await buildClassicEntries(true)
    const oldClient = { getTransportState: vi.fn(() => ({ phase })), stop: vi.fn() }
    const retired = createHost(files, oldClient, true)
    expect(() => retired.load('app.js')).not.toThrow()
    expect(() => retired.load('page.js')).not.toThrow()
    expect(retired.dependencies).toEqual([])
    expect(retired.context.App).not.toHaveBeenCalled()
    expect(retired.context.Page).not.toHaveBeenCalled()
    expect(oldClient.stop).not.toHaveBeenCalled()
    expect(oldClient.getTransportState).not.toHaveBeenCalled()

    const fresh = createHost(files)
    fresh.load('app.js')
    fresh.load('page.js')
    expect(fresh.context.installations).toBe(2)
    expect(fresh.context.App).toHaveBeenCalledExactlyOnceWith({ marker: 'classic-app' })
    expect(fresh.context.Page).toHaveBeenCalledExactlyOnceWith({ data: { marker: 'classic-page' } })
  })

  it('preserves business failures from the fresh classic realm', async () => {
    const { files } = await buildClassicEntries(true)
    const fresh = createHost(files)
    const failure = new Error('classic page business failure')
    fresh.context.businessFailure = failure
    expect(() => fresh.load('page.js')).toThrow(failure)
    expect(fresh.context.installations).toBe(1)
    expect(fresh.context.Page).not.toHaveBeenCalled()
  })

  it('publishes the transformed external sourcemap through the native writer', async () => {
    const { files } = await buildClassicEntries(true)
    const lines = files.get('page.js')!.split('\n')
    const line = lines.findIndex(value => value.includes('"classic-page"'))
    const map = JSON.parse(files.get('page.js.map')!) as { version: 3, names: string[], sources: string[], sourcesContent: string[], mappings: string }
    expect(originalPositionFor(new TraceMap(map), { line: line + 1, column: lines[line]!.indexOf('"classic-page"') }).line).toBe(1)
    expect(map.sourcesContent.some((value: string) => value.includes('"classic-page"'))).toBe(true)
  })
})
