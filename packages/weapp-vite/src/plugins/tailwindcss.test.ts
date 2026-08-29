import type { OutputBundle } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../moduleGraph/protocol'
import { createTailwindcssPlugin, resolveManagedTailwindcssOptions } from './tailwindcss'

const mocks = vi.hoisted(() => ({
  createContext: vi.fn(),
  createGenerator: vi.fn(),
  resolveSource: vi.fn(),
  packageInfo: undefined as { version?: string } | undefined,
}))

vi.mock('weapp-tailwindcss/core', () => ({
  createContext: mocks.createContext,
}))

vi.mock('weapp-tailwindcss/generator', () => ({
  createWeappTailwindcssGenerator: mocks.createGenerator,
  resolveTailwindV4Source: mocks.resolveSource,
}))

vi.mock('../runtime/localPkg', () => ({
  safeGetPackageInfoSync: vi.fn(() => mocks.packageInfo),
}))

function createContext(tailwindcss: any, cwd = '/project') {
  return {
    configService: {
      absoluteSrcRoot: path.join(cwd, 'src'),
      cwd,
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
      },
      platform: 'weapp',
      weappViteConfig: { tailwindcss },
    },
  } as any
}

function getHookHandler<T extends (...args: any[]) => any>(hook: T | { handler: T } | undefined) {
  return typeof hook === 'function' ? hook : hook?.handler
}

function getPlugins(tailwindcss: any, cwd = '/project') {
  return createTailwindcssPlugin(createContext(tailwindcss, cwd))
}

describe('managed Tailwind integration', () => {
  const temporaryRoots: string[] = []

  beforeEach(() => {
    mocks.createContext.mockReset()
    mocks.createGenerator.mockReset()
    mocks.resolveSource.mockReset()
    mocks.packageInfo = undefined
  })

  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { force: true, recursive: true })))
  })

  it('stays disabled when explicitly disabled or when Tailwind is unavailable', () => {
    expect(resolveManagedTailwindcssOptions(createContext(false))).toBeUndefined()
    mocks.packageInfo = { version: '3.4.19' }
    expect(createTailwindcssPlugin(createContext(undefined))).toEqual([])
  })

  it('auto-detects Tailwind v4 but stays dormant until a CSS import is found', () => {
    mocks.packageInfo = { version: '4.3.3' }
    expect(resolveManagedTailwindcssOptions(createContext(undefined))).toMatchObject({
      autoDetected: true,
      cssEntries: [],
    })

    const plugins = getPlugins(undefined)
    expect(plugins).toHaveLength(2)
    const transform = getHookHandler(plugins[0]!.transform)
    expect(transform?.call({}, '.author { color: red; }', '/project/src/app.css', {} as any)).toBeNull()
    expect(mocks.createContext).not.toHaveBeenCalled()
  })

  it('auto-detects an imported Tailwind v4 CSS entry, including nested CSS syntax', () => {
    mocks.packageInfo = { version: '4.3.3' }
    const plugin = getPlugins(undefined)[0]!
    const transform = getHookHandler(plugin.transform)

    expect(transform?.call({}, '@import "tailwindcss" source(none);', '/project/src/styles/nested.css', {} as any)).toMatchObject({
      code: expect.stringContaining('managed_tailwindcss_entry_0'),
      map: null,
    })
  })

  it('auto-detects Tailwind imports from Vue style sidecars', async () => {
    mocks.packageInfo = { version: '4.3.3' }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    const source = '@import "tailwindcss";'
    await fs.mkdir(path.dirname(entry), { recursive: true })
    await fs.writeFile(entry, source, 'utf8')
    const plugin = getPlugins(undefined, root)[0]!
    const resolveId = getHookHandler(plugin.resolveId)
    const sidecar = createSidecarSourceSpecifier(path.join(root, 'src/app.vue'), entry, 'style')

    expect(resolveId?.call({}, sidecar, undefined, {} as any)).toMatch(/managed-tailwindcss-entry:0\.css/)
  })

  it('does not auto-enable Tailwind v3 or when the package is missing', () => {
    mocks.packageInfo = { version: '3.4.19' }
    expect(resolveManagedTailwindcssOptions(createContext(undefined))).toBeUndefined()
    mocks.packageInfo = undefined
    expect(resolveManagedTailwindcssOptions(createContext(undefined))).toBeUndefined()
  })

  it('resolves default and configured CSS entries from the project', () => {
    expect(resolveManagedTailwindcssOptions(createContext(true))).toMatchObject({
      basedir: '/project',
      cssEntries: ['/project/src/app.css'],
      options: {
        appType: 'weapp-vite',
        platform: 'weapp',
        tailwindcssBasedir: '/project',
      },
    })
    expect(resolveManagedTailwindcssOptions(createContext({
      cssEntries: ['styles/app.css'],
      rem2rpx: true,
    }))).toMatchObject({
      cssEntries: ['/project/styles/app.css'],
      options: {
        cssEntries: ['/project/styles/app.css'],
        rem2rpx: true,
      },
    })
  })

  it('does not reject an external integration in the managed plugin', () => {
    const plugin = getPlugins(true)[0]
    const configResolved = getHookHandler(plugin.configResolved)

    expect(() => configResolved?.call({} as any, {
      plugins: [plugin, { name: 'weapp-tailwindcss:adaptor:post' }],
    } as any)).not.toThrow()
  })

  it('uses generator and core APIs to transform one owned bundle', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    await fs.writeFile(entry, '@import "tailwindcss";', 'utf8')

    const calls: string[] = []
    const onLoad = vi.fn(() => calls.push('load'))
    const onStart = vi.fn(() => calls.push('start'))
    const onEnd = vi.fn(() => calls.push('end'))
    const coreContext = {
      transformWxss: vi.fn(async (source: string) => {
        calls.push('wxss')
        return { css: `${source}\n/* core wxss */` }
      }),
      getRuntimeSet: vi.fn(async () => {
        calls.push('runtime')
        return new Set(['gap-4.25'])
      }),
      transformWxml: vi.fn(async (source: string) => {
        calls.push('wxml')
        return source.replace('gap-4.25', 'gap-4_d25')
      }),
      transformJs: vi.fn(async (source: string) => {
        calls.push('js')
        return { code: source.replace('gap-4.25', 'gap-4_d25') }
      }),
    }
    const dispose = vi.fn()
    mocks.createContext.mockReturnValue(coreContext)
    mocks.resolveSource.mockResolvedValue({ source: true })
    mocks.createGenerator.mockReturnValue({
      dispose,
      generate: vi.fn(async () => {
        calls.push('generate')
        return {
          classSet: new Set(['gap-4.25']),
          css: '.gap-4_d25{gap:17rpx}',
          dependencies: [entry],
        }
      }),
    })

    const plugins = getPlugins({
      cssEntries: [entry],
      onEnd,
      onLoad,
      onStart,
    }, root)
    const plugin = plugins[0]
    const outputPlugin = plugins[1]
    const addWatchFile = vi.fn()
    await getHookHandler(plugin.buildStart)?.call({ addWatchFile } as any, {} as any)
    getHookHandler(plugin.configResolved)?.call({} as any, {
      build: { sourcemap: false },
      plugins: [plugin],
    } as any)
    const sidecarEntry = createSidecarSourceSpecifier(path.join(root, 'src/app.ts'), entry, 'style')
    const virtualEntry = await getHookHandler(plugin.resolveId)?.call({} as any, sidecarEntry, undefined, {} as any)
    const marker = await getHookHandler(plugin.load)?.call({} as any, virtualEntry)
    const bundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: `${marker}\n@plugin "@iconify/tailwind4" {}\n@source "./**/*.{wxml,js,ts,vue}";\n.author{color:red}`,
      },
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<view class="gap-4.25" />',
      },
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'const cls = "gap-4.25";',
        map: null,
      },
    } as unknown as OutputBundle

    await getHookHandler(plugin.generateBundle)?.call({ addWatchFile } as any, {} as any, bundle, false)
    await getHookHandler(outputPlugin.generateBundle)?.call({ addWatchFile } as any, {} as any, bundle, false)

    expect((bundle['app.wxss'] as any).source).toContain('.gap-4_d25{gap:17rpx}')
    expect((bundle['app.wxss'] as any).source).toContain('.author{color:red}')
    expect((bundle['app.wxss'] as any).source).not.toMatch(/@(plugin|source)\b/)
    expect((bundle['app.wxss'] as any).source).not.toContain('managed-tailwindcss-entry')
    expect((bundle['pages/index/index.wxml'] as any).source).toContain('gap-4_d25')
    expect((bundle['app.js'] as any).code).toContain('gap-4_d25')
    expect(calls).toEqual([
      'start',
      'load',
      'generate',
      'wxss',
      'end',
      'start',
      'runtime',
      'wxml',
      'js',
      'end',
    ])
    expect(dispose).toHaveBeenCalledOnce()
    expect(addWatchFile).toHaveBeenCalledWith(entry)
  })

  it('only virtualizes managed style sidecars', () => {
    const entry = '/project/src/app.css'
    const plugin = getPlugins({ cssEntries: [entry] })[0]
    const resolveId = getHookHandler(plugin.resolveId)

    expect(resolveId?.call({} as any, './app.css', '/project/src/app.vue', {} as any)).toBeNull()
    expect(resolveId?.call(
      {} as any,
      createSidecarSourceSpecifier('/project/src/app.vue', entry, 'style'),
      undefined,
      {} as any,
    )).toMatch(/^\0weapp-vite:managed-tailwindcss-entry:0\.css\?weapp-vite-sidecar-owner=/)
  })

  it('replaces the managed physical CSS entry with its generator marker', () => {
    const entry = '/project/src/app.css'
    const plugin = getPlugins({ cssEntries: [entry] })[0]
    const transform = getHookHandler(plugin.transform)

    expect(transform?.call(
      {} as any,
      '@import "tailwindcss";',
      `${entry}?direct`,
      {} as any,
    )).toMatchObject({
      code: expect.stringContaining('managed_tailwindcss_entry_0'),
      map: null,
    })
  })

  it('replaces a Vue style module that inlines a managed CSS entry', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    const source = '@import "tailwindcss";\n@source "./**/*.{wxml,js,ts,vue}";\n'
    await fs.writeFile(entry, source, 'utf8')

    const plugin = getPlugins({ cssEntries: [entry] }, root)[0]
    const transform = getHookHandler(plugin.transform)

    expect(transform?.call(
      {} as any,
      source,
      `${path.join(root, 'src/app.vue')}?weapp-vite-vue&type=style&index=0&lang.css`,
      {} as any,
    )).toMatchObject({
      code: expect.stringContaining('managed_tailwindcss_entry_0'),
      map: null,
    })
  })

  it('does not replace CSS outside the managed entry set', () => {
    const plugin = getPlugins(true)[0]
    const transform = getHookHandler(plugin.transform)

    expect(transform?.call(
      {} as any,
      '.author { color: red; }',
      '/project/src/pages/index.css',
      {} as any,
    )).toBeNull()
  })

  it('keeps the original entry in the build graph when generation is disabled', () => {
    const entry = '/project/src/app.css'
    const plugin = getPlugins({ cssEntries: [entry], generator: false })[0]
    const resolveId = getHookHandler(plugin.resolveId)
    const transform = getHookHandler(plugin.transform)

    expect(resolveId?.call(
      {} as any,
      createSidecarSourceSpecifier('/project/src/app.ts', entry, 'style'),
      undefined,
      {} as any,
    )).toBeNull()
    expect(transform?.call(
      {} as any,
      '@import "tailwindcss";',
      entry,
      {} as any,
    )).toBeNull()
  })
})
