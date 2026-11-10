import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_WASM_INIT_QUERY_MARKER } from '@weapp-core/constants'
import { build } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { createWasmPlugin, resolveWasmScope } from './wasm'

function createContext(platform = 'weapp') {
  return {
    configService: {
      platform,
      weappLibConfig: undefined,
    },
  } as unknown as CompilerContext
}

function hook<T>(value: Plugin['load'] | Plugin['config'] | Plugin['configResolved']): T {
  const candidate = value as { handler?: T } | T | undefined
  return typeof candidate === 'function' ? candidate as T : candidate?.handler as T
}

describe('WASM init plugin', () => {
  it('leaves non-init modules and non-WeChat targets to Vite', async () => {
    const plugin = createWasmPlugin(createContext() as CompilerContext, { scope: 'app' })
    const load = hook<(id: string) => Promise<string | null>>(plugin.load)
    const resolve = vi.fn()
    const context = { resolve } as unknown as ThisParameterType<typeof load>

    await expect(load.call(context, '/src/file.wasm?initFoo')).resolves.toBeNull()
    await expect(load.call(context, '/src/file.wasm?url')).resolves.toBeNull()

    const webPlugin = createWasmPlugin(createContext('web'), { scope: 'app' })
    const webLoad = hook<(id: string) => Promise<string | null>>(webPlugin.load)
    await expect(webLoad.call(context, '/src/file.wasm?init')).resolves.toBeNull()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('generates a WXWebAssembly initializer and resolves a no-inline URL module with the reserved marker', async () => {
    const plugin = createWasmPlugin(createContext(), { scope: 'app' })
    const load = hook<(id: string) => Promise<string>>(plugin.load)
    const resolved = { id: '/project/src/add.wasm?url&no-inline' }
    const resolve = vi.fn().mockResolvedValue(resolved)
    const context = {
      resolve,
      error(message: string): never {
        throw new Error(message)
      },
    } as unknown as ThisParameterType<typeof load>

    const source = await load.call(context, '/project/src/add.wasm?init')

    expect(resolve).toHaveBeenCalledWith(
      `/project/src/add.wasm?url&no-inline&${WEAPP_VITE_WASM_INIT_QUERY_MARKER}`,
      '/project/src/add.wasm?init',
      { skipSelf: true },
    )
    expect(source).toContain('host.instantiate(wasmPath, imports)')
    expect(source).toContain('result.instance')
    expect(source).toContain('result.exports')
  })

  it.each(['raw', 'url', 'inline'])('rejects the mutually exclusive ?%s query', async (flag) => {
    const plugin = createWasmPlugin(createContext(), { scope: 'app' })
    const load = hook<(id: string) => Promise<string | null>>(plugin.load)
    const context = {
      error(message: string): never {
        throw new Error(message)
      },
    } as unknown as ThisParameterType<typeof load>
    await expect(load.call(context, `/project/src/add.wasm?init&${flag}`)).rejects.toThrow('cannot be combined')
  })

  it('rejects publicDir, plugin projects and lib mode before emitting an initializer', async () => {
    const publicPlugin = createWasmPlugin(createContext(), { scope: 'app' })
    const publicLoad = hook<(id: string) => Promise<string | null>>(publicPlugin.load)
    hook<(config: ResolvedConfig) => void>(publicPlugin.configResolved)({
      command: 'build',
      publicDir: '/project/public',
      experimental: {},
    } as ResolvedConfig)
    const context = {
      error(message: string): never {
        throw new Error(message)
      },
    } as unknown as ThisParameterType<typeof publicLoad>
    await expect(publicLoad.call(context, '/project/public/add.wasm?init')).rejects.toThrow('not supported for files in `publicDir`')

    const pluginContext = createContext() as CompilerContext
    pluginContext.currentBuildTarget = 'plugin'
    const pluginLoad = hook<(id: string) => Promise<string | null>>(createWasmPlugin(pluginContext, { scope: 'app' }).load)
    await expect(pluginLoad.call(context, '/project/src/add.wasm?init')).rejects.toThrow('plugin projects or lib mode')
  })

  it('maps emitted package paths and preserves a user URL callback for other assets', () => {
    const previous = vi.fn(() => ({ runtime: 'customAssetUrl()' }))
    const plugin = createWasmPlugin(createContext(), { scope: 'independent', packageRoot: 'isolated' })
    const config = hook<(config: { experimental?: { renderBuiltUrl?: typeof previous } }, env: { command: 'build' }) => { experimental: { renderBuiltUrl: typeof previous } }>(plugin.config)
    const result = config({ experimental: { renderBuiltUrl: previous } }, { command: 'build' })
    const renderBuiltUrl = result.experimental.renderBuiltUrl

    expect(renderBuiltUrl(`isolated/assets/add-abc.wasm?${WEAPP_VITE_WASM_INIT_QUERY_MARKER}`, { hostType: 'js', type: 'asset', ssr: false, hostId: 'entry.js' })).toEqual({ runtime: JSON.stringify('/isolated/assets/add-abc.wasm') })
    expect(() => renderBuiltUrl(`assets/add-abc.wasm?${WEAPP_VITE_WASM_INIT_QUERY_MARKER}`, { hostType: 'js', type: 'asset', ssr: false, hostId: 'entry.js' })).toThrow('escaped its package root')
    expect(renderBuiltUrl('assets/add-abc.wasm', { hostType: 'js', type: 'asset', postfix: '?url' })).toEqual({ runtime: 'customAssetUrl()' })
    expect(previous).toHaveBeenCalledTimes(1)
    expect(resolveWasmScope({ ...createContext(), scanService: {} } as CompilerContext, undefined, true)).toEqual({ scope: 'worker', workerRoot: undefined })

    const appPlugin = createWasmPlugin(createContext(), { scope: 'app', workerRoot: 'workers' })
    const appConfig = hook<typeof config>(appPlugin.config)({}, { command: 'build' })
    expect(() => appConfig.experimental.renderBuiltUrl(`workers/add.wasm?${WEAPP_VITE_WASM_INIT_QUERY_MARKER}`, { hostType: 'js', type: 'asset', ssr: false, hostId: 'entry.js' }))
      .toThrow('cannot be emitted inside package or Worker root')

    const webPlugin = createWasmPlugin(createContext('web'), { scope: 'app' })
    const webOutput = hook<(options: { assetFileNames?: string }) => unknown>(webPlugin.outputOptions)
    expect(webOutput({ assetFileNames: 'custom/[name].wasm' })).toBeNull()
  })

  it('constrains independent and Worker WASM assets and leaves main-package naming to Vite', () => {
    const plugin = createWasmPlugin(createContext(), { scope: 'independent', packageRoot: 'isolated' })
    hook<(config: ResolvedConfig) => void>(plugin.configResolved)({ command: 'build', root: '/project', publicDir: false, experimental: {} } as ResolvedConfig)
    const outputOptions = hook<(options: { assetFileNames?: string | ((asset: { originalFileNames?: string[] }) => string) }) => { assetFileNames: (asset: { originalFileNames?: string[] }) => string }>(plugin.outputOptions)
    const naming = vi.fn(() => 'assets/engine-[hash].wasm')
    const independent = outputOptions({ assetFileNames: naming })
    expect(independent.assetFileNames({ originalFileNames: ['src/engine.wasm'] })).toBe('isolated/assets/engine-[hash].wasm')
    expect(independent.assetFileNames({ originalFileNames: ['src/ordinary.wasm'] })).toBe('isolated/assets/engine-[hash].wasm')
    expect(independent.assetFileNames({ originalFileNames: ['src/image.png'] })).toBe('assets/engine-[hash].wasm')
    expect(naming).toHaveBeenCalledTimes(3)

    const worker = createWasmPlugin(createContext(), { scope: 'worker', workerRoot: 'workers' })
    hook<(config: ResolvedConfig) => void>(worker.configResolved)({ command: 'build', root: '/project', publicDir: false, experimental: {} } as ResolvedConfig)
    const workerOptions = hook<(options: { assetFileNames?: string }) => { assetFileNames: (asset: { originalFileNames?: string[] }) => string }>(worker.outputOptions)
    expect(workerOptions({ assetFileNames: 'workers/[name]-[hash][extname]' }).assetFileNames({ originalFileNames: ['src/engine.wasm'] }))
      .toBe('assets/[name]-[hash][extname]')

    const app = createWasmPlugin(createContext(), { scope: 'app', reservedRoots: ['subpackage', 'workers'] })
    hook<(config: ResolvedConfig) => void>(app.configResolved)({ command: 'build', root: '/project', publicDir: false, experimental: {} } as ResolvedConfig)
    const appOptions = hook<(options: { assetFileNames?: string }) => null>(app.outputOptions)
    expect(appOptions({ assetFileNames: 'subpackage/[name].wasm' })).toBeNull()
  })

  it('forwards imports, adapts host instance results, and preserves host rejections', async () => {
    const plugin = createWasmPlugin(createContext(), { scope: 'app' })
    const load = hook<(id: string) => Promise<string>>(plugin.load)
    const resolve = vi.fn().mockResolvedValue({ id: '/project/add.wasm?url&no-inline' })
    const error = (message: string): never => {
      throw new Error(message)
    }
    const generated = await load.call({ resolve, error } as unknown as ThisParameterType<typeof load>, '/project/add.wasm?init')
    const source = generated
      .replace(/^import wasmPath from .*;\n/, 'const wasmPath = "/assets/add.wasm";\n')
      .replace('export default async function init', 'async function init')
    const imports = {}
    const instance = { exports: { add: () => 3 } }
    let receivedImports: object | undefined
    const initializer = runInNewContext(`${source}; init`, {
      WXWebAssembly: {
        instantiate: async (_file: string, wasmImports: object) => {
          receivedImports = wasmImports
          return { instance }
        },
      },
      instance,
    }) as (imports?: object) => Promise<{ exports: object }>
    const result = await initializer(imports)
    expect(result).toBeInstanceOf(Object)
    expect(receivedImports).toBe(imports)

    const directExports = { exports: { add: () => 3 } }
    const direct = runInNewContext(`${source}; init`, {
      WXWebAssembly: { instantiate: async () => directExports },
    }) as () => Promise<unknown>
    await expect(direct()).resolves.toBe(directExports)

    const unsupported = runInNewContext(`${source}; init`, {
      WXWebAssembly: { instantiate: async () => ({ instance: {} }) },
    }) as () => Promise<unknown>
    await expect(unsupported()).rejects.toThrow('unsupported result')

    const hostError = new Error('host instantiate failed')
    const rejected = runInNewContext(`${source}; init`, {
      WXWebAssembly: { instantiate: () => Promise.reject(hostError) },
      hostError,
    }) as () => Promise<unknown>
    await expect(rejected()).rejects.toBe(hostError)

    const unavailable = runInNewContext(`${source}; init`, {}) as () => Promise<unknown>
    await expect(unavailable()).rejects.toThrow('2.13.0')
  })

  it('emits a hashed WASM file and embeds its exact package path through Vite renderBuiltUrl', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-'))
    const outDir = path.join(root, 'dist')
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src/main.js'), 'import init from \'./add.wasm?init\'; globalThis.__wasmInit = init')
    await writeFile(path.join(root, 'src/add.wasm'), new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

    try {
      const output = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [createWasmPlugin(createContext() as CompilerContext, { scope: 'app' })],
        build: {
          outDir,
          assetsDir: 'assets',
          assetsInlineLimit: 0,
          rollupOptions: { input: path.join(root, 'src/main.js') },
        },
      })
      const outputs = Array.isArray(output) ? output : [output]
      const bundle = outputs.flatMap(result => result.output)
      const asset = bundle.find(item => item.type === 'asset' && item.fileName.endsWith('.wasm'))
      const chunks = bundle.filter(item => item.type === 'chunk')

      expect(asset?.type).toBe('asset')
      expect(chunks.length).toBeGreaterThan(0)
      if (asset?.type !== 'asset' || chunks.length === 0) {
        throw new Error('Expected a JavaScript chunk and emitted WASM asset.')
      }
      expect([...await readFile(path.join(outDir, asset.fileName))]).toEqual([0, 97, 115, 109, 1, 0, 0, 0])
      const code = chunks.map(chunk => chunk.code).join('\n')
      expect(code).toContain(`/${asset.fileName}`)
      expect(code).toContain('WXWebAssembly')
      expect(code).not.toContain('data:application/wasm')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['url', 'init'])('preserves URL naming and validates init paths for ?%s', async (query) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-url-'))
    const outDir = path.join(root, 'dist')
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src/main.js'), `import wasmValue from "./add.wasm?${query}"; globalThis.__wasmValue = wasmValue`)
    await writeFile(path.join(root, 'src/add.wasm'), new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    try {
      const building = build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [createWasmPlugin(createContext() as CompilerContext, { scope: 'app', reservedRoots: ['regular'] })],
        build: {
          outDir,
          assetsInlineLimit: 0,
          rolldownOptions: {
            input: path.join(root, 'src/main.js'),
            output: {
              assetFileNames: () => 'regular/[name]-[hash][extname]',
            },
          },
        },
      })
      if (query === 'init') {
        await expect(building).rejects.toThrow('cannot be emitted inside package or Worker root')
        return
      }
      const output = await building
      const outputs = Array.isArray(output) ? output : [output]
      const asset = outputs.flatMap(result => result.output).find(item => item.type === 'asset' && item.fileName.endsWith('.wasm'))

      expect(asset?.type).toBe('asset')
      expect(asset?.fileName).toMatch(/^regular\/add-.+\.wasm$/)
      expect([...await readFile(path.join(outDir, asset!.fileName))]).toEqual([0, 97, 115, 109, 1, 0, 0, 0])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('emits independent WASM under its package root and references the emitted file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-independent-'))
    const outDir = path.join(root, 'dist')
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src/main.js'), 'import init from "./add.wasm?init"; globalThis.__wasmInit = init')
    await writeFile(path.join(root, 'src/add.wasm'), new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

    try {
      const output = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [createWasmPlugin(createContext() as CompilerContext, { scope: 'independent', packageRoot: 'isolated' })],
        build: {
          outDir,
          assetsDir: 'assets',
          assetsInlineLimit: 0,
          rolldownOptions: {
            input: path.join(root, 'src/main.js'),
            output: { chunkFileNames: 'isolated/[name].js' },
          },
        },
      })
      const outputs = Array.isArray(output) ? output : [output]
      const bundle = outputs.flatMap(result => result.output)
      const asset = bundle.find(item => item.type === 'asset' && item.fileName.endsWith('.wasm'))
      const code = bundle.filter(item => item.type === 'chunk').map(chunk => chunk.code).join('\n')
      expect(asset?.type).toBe('asset')
      if (asset?.type !== 'asset') {
        throw new Error('Expected an emitted WASM asset.')
      }
      expect(asset.fileName).toMatch(/^isolated\//)
      expect(code).toContain(`/${asset.fileName}`)
      expect([...await readFile(path.join(outDir, asset.fileName))]).toEqual([0, 97, 115, 109, 1, 0, 0, 0])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('emits Worker WASM outside the Worker script directory and references the package path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-worker-'))
    const outDir = path.join(root, 'dist')
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src/main.js'), 'import init from "./add.wasm?init"; globalThis.__wasmInit = init')
    await writeFile(path.join(root, 'src/add.wasm'), new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

    try {
      const output = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [createWasmPlugin(createContext() as CompilerContext, { scope: 'worker', workerRoot: 'workers' })],
        build: {
          outDir,
          assetsDir: 'workers',
          assetsInlineLimit: 0,
          rolldownOptions: {
            input: path.join(root, 'src/main.js'),
            output: { entryFileNames: 'workers/[name].js' },
          },
        },
      })
      const outputs = Array.isArray(output) ? output : [output]
      const bundle = outputs.flatMap(result => result.output)
      const asset = bundle.find(item => item.type === 'asset' && item.fileName.endsWith('.wasm'))
      const chunk = bundle.find(item => item.type === 'chunk')
      expect(asset?.type).toBe('asset')
      expect(chunk?.type).toBe('chunk')
      if (asset?.type !== 'asset' || chunk?.type !== 'chunk') {
        throw new Error('Expected a Worker chunk and emitted WASM asset.')
      }
      expect(asset.fileName).not.toMatch(/^workers\//)
      expect(chunk.fileName).toMatch(/^workers\//)
      expect(chunk.code).toContain(`/${asset.fileName}`)
      expect([...await readFile(path.join(outDir, asset.fileName))]).toEqual([0, 97, 115, 109, 1, 0, 0, 0])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['app', 'independent'] as const)('shares mixed init/URL assets in %s scope with encoded source names', async (scope) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-mixed-'))
    const outDir = path.join(root, 'dist')
    const assetName = 'space % 中文.wasm'
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src/main.js'), `import url from ${JSON.stringify(`./${assetName}?url`)}; import init from "./initializer.js"; globalThis.__wasm = [init, url]`)
    await writeFile(path.join(root, 'src/initializer.js'), `export { default } from ${JSON.stringify(`./${assetName}?init`)}`)
    await writeFile(path.join(root, 'src', assetName), new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    const plugin = createWasmPlugin(createContext() as CompilerContext, { scope, packageRoot: 'isolated' })

    try {
      const output = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [{
          name: 'delay-init-resolution',
          enforce: 'pre',
          async load(id) {
            if (id.endsWith('/initializer.js')) {
              await new Promise(resolve => setTimeout(resolve, 50))
            }
            return null
          },
        }, plugin],
        build: {
          outDir,
          assetsDir: 'assets',
          assetsInlineLimit: 0,
          rolldownOptions: { input: path.join(root, 'src/main.js') },
        },
      })
      const outputs = Array.isArray(output) ? output : [output]
      const bundle = outputs.flatMap(result => result.output)
      const assets = bundle.filter(item => item.type === 'asset' && item.fileName.endsWith('.wasm'))
      const chunks = bundle.filter(item => item.type === 'chunk')
      expect(assets).toHaveLength(1)
      const asset = assets[0]
      expect(asset?.type).toBe('asset')
      if (scope === 'independent') {
        expect(asset?.fileName).toMatch(/^isolated\//)
      }
      expect(chunks.map(chunk => chunk.code).join('\n')).toContain(`/${asset?.fileName}`)
      expect([...await readFile(path.join(outDir, asset!.fileName))]).toEqual([0, 97, 115, 109, 1, 0, 0, 0])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
