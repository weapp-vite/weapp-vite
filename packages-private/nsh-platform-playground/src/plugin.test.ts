import type { Plugin, ResolvedConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { nshPlatformRuntime, nshPlatformRuntimeFiles } from './plugin'

const packageRoot = path.resolve(import.meta.dirname, '..')
const runtimeRoot = path.join(packageRoot, 'fixtures/runtime')
const wasmFile = path.join(packageRoot, 'src/wasm/demo.wasm')
const temporaryRoots: string[] = []

function loadRuntimeModule<T>(file: string): T {
  const filename = path.join(packageRoot, file)
  interface RuntimeModule { exports: Record<string, unknown> }
  const module: RuntimeModule = { exports: {} }
  const require = (request: string) => loadRuntimeModule(path.relative(packageRoot, path.resolve(path.dirname(filename), request)))
  const wrapper = vm.runInThisContext(`(function (module, exports, require) {\n${readFileSync(filename, 'utf8')}\n})`, { filename }) as (
    module: RuntimeModule,
    exports: Record<string, unknown>,
    require: (request: string) => unknown,
  ) => void
  wrapper(module, module.exports, require)
  return module.exports as T
}

const { start } = loadRuntimeModule<{ start: (page: any, host: any) => Promise<any> }>('fixtures/runtime/nsh/nsh-mp.js')

function createCanvas() {
  return {
    width: 1,
    height: 1,
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      arcTo() {},
      closePath() {},
      fill() {},
      createLinearGradient: () => ({ addColorStop() {} }),
    }),
    toDataURL: () => 'data:image/png;base64,AA==',
  }
}

function fakePage() {
  const page = {
    data: { root: { id: 1, c: [] as any[] }, ov: [] as any[] },
    setData(update: Record<string, unknown>) {
      for (const [key, value] of Object.entries(update)) {
        if (key === 'root') {
          page.data.root = structuredClone(value) as typeof page.data.root
        }
        else if (key === 'ov') {
          page.data.ov = structuredClone(value) as any[]
        }
        else if (key.startsWith('root.')) {
          const steps = key.replace(/^root\./, '').replace(/\[(\d+)\]/g, '.$1').split('.')
          let target: any = page.data.root
          for (const step of steps.slice(0, -1)) {
            target = target[step]
          }
          target[steps.at(-1)!] = structuredClone(value)
        }
      }
    },
  }
  return page
}

function fakeHost() {
  const listeners = new Set<() => void>()
  return {
    instantiate: async (_file: string, imports: WebAssembly.Imports) => {
      const bytes = await readFile(wasmFile)
      return WebAssembly.instantiate(bytes, imports)
    },
    measure: (_font: string, text: string) => text.length * 8,
    device: () => ({ width: 375, height: 667, pixelRatio: 2, dark: false, os: 'ios' }),
    onThemeChange: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onResize: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    now: () => performance.now(),
    setTimeout,
    clearTimeout,
    navigateTo: async () => {},
    navigateBack: async () => {},
    setTitle() {},
    offscreenCanvas: () => createCanvas(),
    error(message: string) {
      throw new Error(message)
    },
    log() {},
    listeners,
  }
}

function pluginHook<T>(hook: Plugin['configResolved'] | Plugin['buildStart']): T {
  return hook as T
}

async function temporaryDirectory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nsh-platform-playground-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('nshPlatformRuntime', () => {
  it('emits the fixed runtime snapshot and a complete Mini Program project', async () => {
    const root = await temporaryDirectory()
    const outDir = path.join(root, 'dist')
    await build({
      configFile: false,
      root: packageRoot,
      logLevel: 'silent',
      publicDir: false,
      plugins: [nshPlatformRuntime({ wasm: wasmFile, outputRoot: 'miniapp', appName: 'Fixture App', appid: 'wxfixture' })],
      build: {
        outDir,
        emptyOutDir: true,
        rolldownOptions: { input: path.join(packageRoot, 'src/main.ts') },
      },
    })

    for (const file of nshPlatformRuntimeFiles) {
      expect(await readFile(path.join(outDir, 'miniapp', file))).toEqual(await readFile(path.join(runtimeRoot, file)))
    }
    for (const file of ['app.json', 'sitemap.json', 'project.config.json', 'nsh/app.wasm.br']) {
      await access(path.join(outDir, 'miniapp', file))
    }
    const app = JSON.parse(await readFile(path.join(outDir, 'miniapp/app.json'), 'utf8')) as { window: { navigationBarTitleText: string } }
    const project = JSON.parse(await readFile(path.join(outDir, 'miniapp/project.config.json'), 'utf8')) as { appid: string }
    expect(app.window.navigationBarTitleText).toBe('Fixture App')
    expect(project.appid).toBe('wxfixture')
    expect(brotliDecompressSync(await readFile(path.join(outDir, 'miniapp/nsh/app.wasm.br')))).toEqual(await readFile(wasmFile))
  })

  it('supports POSIX output paths when configured with Windows separators', async () => {
    const root = await temporaryDirectory()
    const outDir = path.join(root, 'dist')
    await build({
      configFile: false,
      root: packageRoot,
      logLevel: 'silent',
      publicDir: false,
      plugins: [nshPlatformRuntime({ wasm: wasmFile, outputRoot: 'miniapp\\nested' })],
      build: { outDir, emptyOutDir: true, rolldownOptions: { input: path.join(packageRoot, 'src/main.ts') } },
    })
    await access(path.join(outDir, 'miniapp/nested/nsh/app.wasm.br'))
  })

  it('copies an already Brotli-compressed WASM module byte-for-byte', async () => {
    const root = await temporaryDirectory()
    const compressedWasm = path.join(root, 'fixture.wasm.br')
    const expected = brotliCompressSync(await readFile(wasmFile))
    await writeFile(compressedWasm, expected)
    const outDir = path.join(root, 'dist')
    await build({
      configFile: false,
      root,
      logLevel: 'silent',
      publicDir: false,
      plugins: [nshPlatformRuntime({ wasm: 'fixture.wasm.br' })],
      build: { outDir, emptyOutDir: true, rolldownOptions: { input: path.join(packageRoot, 'src/main.ts') } },
    })
    expect(await readFile(path.join(outDir, 'nsh/app.wasm.br'))).toEqual(expected)
  })

  it('rejects output paths already emitted by another Vite plugin', async () => {
    const root = await temporaryDirectory()
    const outDir = path.join(root, 'dist')
    await expect(build({
      configFile: false,
      root: packageRoot,
      logLevel: 'silent',
      publicDir: false,
      plugins: [{
        name: 'fixture:conflicting-output',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'app.json', source: '{}' })
        },
      }, nshPlatformRuntime({ wasm: wasmFile })],
      build: { outDir, emptyOutDir: true, rolldownOptions: { input: path.join(packageRoot, 'src/main.ts') } },
    })).rejects.toThrow('Output path is already emitted by another plugin: app.json')
  })

  it('rejects output paths that escape the Vite output root', () => {
    expect(() => nshPlatformRuntime({ wasm: wasmFile, outputRoot: '../outside' })).toThrow('Invalid outputRoot')
    expect(() => nshPlatformRuntime({ wasm: wasmFile, outputRoot: 'C:\\outside' })).toThrow('Invalid outputRoot')
    expect(() => nshPlatformRuntime({ wasm: wasmFile, outputRoot: '/outside' })).toThrow('Invalid outputRoot')
  })

  it('rejects missing WASM inputs and conflicting project configuration', async () => {
    const missing = nshPlatformRuntime({ wasm: 'missing.wasm' })
    const resolved = pluginHook<(config: ResolvedConfig) => void>(missing.configResolved)
    resolved({ root: packageRoot, publicDir: false } as unknown as ResolvedConfig)
    const buildStart = pluginHook<() => Promise<void>>(missing.buildStart)
    const missingContext = {
      error(message: string): never { throw new Error(message) },
      addWatchFile() {},
    }
    await expect(buildStart.call(missingContext)).rejects.toThrow('WASM file does not exist')

    const conflictRoot = await temporaryDirectory()
    await writeFile(path.join(conflictRoot, 'app.json'), '{}')
    await writeFile(path.join(conflictRoot, 'fixture.wasm'), await readFile(wasmFile))
    const conflicting = nshPlatformRuntime({ wasm: 'fixture.wasm' })
    pluginHook<(config: ResolvedConfig) => void>(conflicting.configResolved)({ root: conflictRoot, publicDir: false } as unknown as ResolvedConfig)
    const conflictBuildStart = pluginHook<() => Promise<void>>(conflicting.buildStart)
    const conflictContext = {
      error(message: string): never { throw new Error(message) },
      addWatchFile() {},
    }
    await expect(conflictBuildStart.call(conflictContext)).rejects.toThrow('Refusing to overwrite source file: app.json')
  })

  it('rejects WASM inputs outside the Vite root', async () => {
    const root = await temporaryDirectory()
    const plugin = nshPlatformRuntime({ wasm: '../outside.wasm' })
    pluginHook<(config: ResolvedConfig) => void>(plugin.configResolved)({ root, publicDir: false } as unknown as ResolvedConfig)
    const buildStart = pluginHook<() => Promise<void>>(plugin.buildStart)
    const context = {
      error(message: string): never { throw new Error(message) },
      addWatchFile() {},
    }
    await expect(buildStart.call(context)).rejects.toThrow('WASM path must stay within the Vite root')
  })

  it('runs the fixture through the real runtime, applies taps, draws canvas, and stops cleanly', async () => {
    const page = fakePage()
    const host = fakeHost()
    const app = await start(page, host)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(page.data.root.c[0].c[0].t.runs[0][0]).toBe('NSH runtime demo')
    expect(page.data.root.c[0].c[1].c[0].cv).toMatch(/^data:image\/png/)

    app.event(6, 'onPress')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(page.data.root.c[0].c[0].t.runs[0][0]).toBe('Clicked through NSH runtime')
    expect(page.data.root.c[0].c[1].c[0].cv).toMatch(/^data:image\/png/)

    app.stop()
    expect(host.listeners.size).toBe(0)
  })
})
