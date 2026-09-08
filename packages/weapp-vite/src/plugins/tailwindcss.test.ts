import type { OutputBundle } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileVueStyleToWxss, readAndParseSfc } from 'wevu/compiler'
import { createSidecarSourceSpecifier } from '../moduleGraph/protocol'
import { createTailwindcssPlugin, resolveManagedTailwindcssOptions } from './tailwindcss'
import { hasManagedTailwindcssEntries } from './tailwindcssMarker'
import { buildWeappVueStyleRequest } from './vue/transform/styleRequest'

const mocks = vi.hoisted(() => ({
  createCompiler: vi.fn(),
  packageInfo: undefined as { version?: string } | undefined,
  parseCss: vi.fn((source: string) => ({
    source,
    toString() {
      return this.source
    },
  })),
  removeTailwindSourceDirectivesRoot: vi.fn((root: { source: string }) => {
    root.source = root.source.replace(/@theme[^{}]*\{[^{}]*\}\s*/g, '')
    return true
  }),
}))

vi.mock('weapp-tailwindcss/core', () => ({
  createCompiler: mocks.createCompiler,
  postcss: {
    parse: mocks.parseCss,
  },
  removeTailwindSourceDirectivesRoot: mocks.removeTailwindSourceDirectivesRoot,
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
    mocks.createCompiler.mockReset()
    mocks.parseCss.mockClear()
    mocks.removeTailwindSourceDirectivesRoot.mockClear()
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

  it('clears managed output ownership when configuration disables the integration', () => {
    const ctx = createContext(true)
    createTailwindcssPlugin(ctx)
    expect(hasManagedTailwindcssEntries(ctx)).toBe(true)
    ctx.configService.weappViteConfig.tailwindcss = false
    expect(createTailwindcssPlugin(ctx)).toEqual([])
    expect(hasManagedTailwindcssEntries(ctx)).toBe(false)
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
    expect(mocks.createCompiler).not.toHaveBeenCalled()
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

    expect(resolveId?.call({}, sidecar, undefined, {} as any)).toBe(sidecar)
  })

  it('does not auto-enable Tailwind v3 or when the package is missing', () => {
    mocks.packageInfo = { version: '3.4.19' }
    expect(resolveManagedTailwindcssOptions(createContext(undefined))).toBeUndefined()
    mocks.packageInfo = undefined
    expect(resolveManagedTailwindcssOptions(createContext(undefined))).toBeUndefined()
  })

  it('resolves default and configured CSS entries from the project', () => {
    const onRootEvicted = vi.fn()
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
      compiler: {
        maxRoots: 64,
        onRootEvicted,
      },
      rem2rpx: true,
    }))).toMatchObject({
      cssEntries: ['/project/styles/app.css'],
      options: {
        cssEntries: ['/project/styles/app.css'],
        compiler: {
          maxRoots: 64,
          onRootEvicted,
        },
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

  it('uses compiler APIs to transform one owned bundle', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    await fs.writeFile(entry, '@import "tailwindcss";', 'utf8')

    const calls: string[] = []
    const onLoad = vi.fn(() => calls.push('load'))
    const onStart = vi.fn(() => calls.push('start'))
    const onEnd = vi.fn(() => calls.push('end'))
    const onRootEvicted = vi.fn()
    const transformedCssSources: string[] = []
    const snapshot = {
      classSet: new Set(['gap-4.25']),
      dependencies: [entry],
      roots: [{ id: 'tailwind-root', revision: 1 }],
      sources: [],
      target: 'weapp',
    }
    const compiler = {
      createSnapshot: vi.fn(() => snapshot),
      mergeSnapshots: vi.fn(() => {
        calls.push('merge')
        return snapshot
      }),
      generate: vi.fn(async () => {
        calls.push('generate')
        return {
          classSet: new Set(['gap-4.25']),
          css: '.gap-4_d25{gap:17rpx}',
          dependencies: [entry],
          snapshot,
          target: 'weapp',
        }
      }),
      transformCss: vi.fn(async (source: string) => {
        calls.push('wxss')
        transformedCssSources.push(source)
        return {
          css: `${source.replace(/@plugin[^\n]*\n?|@source[^\n]*\n?/g, '')}\n/* core wxss */`,
        }
      }),
      transformTemplate: vi.fn(async (source: string) => {
        calls.push('wxml')
        return source.replace('gap-4.25', 'gap-4_d25')
      }),
      transformJavaScript: vi.fn(async (source: string) => {
        calls.push('js')
        return { code: source.replace('gap-4.25', 'gap-4_d25') }
      }),
      invalidate: vi.fn(() => []),
      remove: vi.fn(async () => {}),
      dispose: vi.fn(),
    }
    const dispose = compiler.dispose
    mocks.createCompiler.mockReturnValue(compiler)

    const plugins = getPlugins({
      cssEntries: [entry],
      tailwindcss: {
        v4: {
          sources: [{
            base: root,
            pattern: 'src/**/*.{vue,ts}',
            negated: false,
          }],
        },
      },
      compiler: {
        maxRoots: 32,
        onRootEvicted,
      },
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
    const loaded = await getHookHandler(plugin.load)?.call({} as any, virtualEntry)
    const marker = getHookHandler(plugin.transform)?.call({} as any, loaded, virtualEntry, {} as any)?.code
    const bundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: `${marker}\n@plugin "@iconify/tailwind4" {}\n@source "./**/*.{wxml,js,ts,vue}";\n@theme default { --color-brand: red; }\n.author{color:red}`,
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
    bundle['late.wxss'] = {
      type: 'asset',
      fileName: 'late.wxss',
      source: marker,
    } as any
    await getHookHandler(outputPlugin.generateBundle)?.call({ addWatchFile } as any, {} as any, bundle, false)
    await outputPlugin.closeBundle?.call({} as any)

    expect((bundle['app.wxss'] as any).source).toContain('.gap-4_d25{gap:17rpx}')
    expect((bundle['app.wxss'] as any).source).toContain('.author{color:red}')
    expect((bundle['app.wxss'] as any).source).not.toMatch(/@(plugin|source|theme)\b/)
    expect((bundle['app.wxss'] as any).source).not.toContain('managed-tailwindcss-entry')
    expect((bundle['late.wxss'] as any).source).toContain('.gap-4_d25{gap:17rpx}')
    expect((bundle['pages/index/index.wxml'] as any).source).toContain('gap-4_d25')
    expect((bundle['app.js'] as any).code).toContain('gap-4_d25')
    expect(transformedCssSources[0]).toMatch(/@plugin "@iconify\/tailwind4"/)
    expect(transformedCssSources[0]).toMatch(/@source "\.\/\*\*\/\*\.\{wxml,js,ts,vue\}"/)
    expect(transformedCssSources[0]).toMatch(/@theme default/)
    expect(mocks.removeTailwindSourceDirectivesRoot).toHaveBeenCalledOnce()
    expect(compiler.transformTemplate).toHaveBeenCalledWith(
      '<view class="gap-4.25" />',
      snapshot,
      { filename: 'pages/index/index.wxml' },
    )
    expect(mocks.createCompiler).toHaveBeenCalledWith(expect.objectContaining({
      compiler: {
        maxRoots: 32,
        onRootEvicted,
      },
    }))
    expect(compiler.generate).toHaveBeenCalledWith(expect.objectContaining({
      sourceOptions: expect.objectContaining({
        sources: [{
          base: root,
          pattern: 'src/**/*.{vue,ts}',
          negated: false,
        }],
      }),
    }))
    expect(calls).toEqual([
      'start',
      'load',
      'generate',
      'merge',
      'wxss',
      'wxss',
      'wxml',
      'js',
      'end',
    ])
    expect(dispose).toHaveBeenCalledOnce()
    expect(addWatchFile).toHaveBeenCalledWith(entry)
  })

  it('keeps managed style sidecar request identity visible to user pre plugins', () => {
    const entry = '/project/src/app.css'
    const plugin = getPlugins({ cssEntries: [entry] })[0]
    const resolveId = getHookHandler(plugin.resolveId)

    expect(resolveId?.call({} as any, './app.css', '/project/src/app.vue', {} as any)).toBeNull()
    const sidecar = createSidecarSourceSpecifier('/project/src/app.vue', entry, 'style')
    expect(resolveId?.call(
      {} as any,
      sidecar,
      undefined,
      {} as any,
    )).toBe(sidecar)
  })

  it('keeps dependency-only style requests out of every CSS generation hook', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwind-dependency-only-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    await fs.writeFile(entry, '@import "tailwindcss";')
    const plugin = getPlugins({ cssEntries: [entry] }, root)[0]!
    const request = createSidecarSourceSpecifier(path.join(root, 'src/app.ts'), entry, 'style', true)
    expect(getHookHandler(plugin.resolveId)?.call({} as any, request, undefined, {} as any)).toBeNull()
    expect(getHookHandler(plugin.load)?.call({} as any, request)).toBeNull()
    expect(getHookHandler(plugin.transform)?.call({} as any, 'export default "dependency";', request, {} as any)).toBeNull()
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })

  it('invalidates only changed files and removes generated entries when deleted', async () => {
    const entry = '/project/src/app.css'
    const snapshot = {
      classSet: new Set<string>(),
      dependencies: [entry],
      roots: [{ id: 'tailwind-root', revision: 1 }],
      sources: [],
      target: 'weapp',
    }
    const compiler = {
      generate: vi.fn(async () => ({
        css: '',
        dependencies: [entry],
        snapshot,
      })),
      mergeSnapshots: vi.fn(() => snapshot),
      transformCss: vi.fn(async (source: string) => ({ css: source })),
      invalidate: vi.fn(() => ['root']),
      remove: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    }
    mocks.createCompiler.mockReturnValue(compiler)
    const [plugin, outputPlugin] = getPlugins({ cssEntries: [entry] })
    const marker = getHookHandler(plugin.transform)?.call(
      {} as any,
      '@import "tailwindcss";',
      entry,
      {} as any,
    )?.code
    const bundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: marker,
      },
    } as unknown as OutputBundle

    await getHookHandler(plugin.generateBundle)?.call({ addWatchFile: vi.fn() } as any, {} as any, bundle, false)
    await getHookHandler(outputPlugin.generateBundle)?.call({ addWatchFile: vi.fn() } as any, {} as any, bundle, false)

    await plugin.watchChange?.('/project/src/pages/index.wxml', { event: 'update' } as any)
    expect(compiler.invalidate).toHaveBeenCalledWith(['/project/src/pages/index.wxml'])

    await plugin.watchChange?.(entry, { event: 'delete' } as any)
    expect(compiler.remove).toHaveBeenCalledWith(expect.stringContaining('weapp-vite:tailwindcss:0:'))
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

  it('does not steal an inline Vue style with the same text as a managed CSS entry', async () => {
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
    )).toBeNull()
  })

  it.each(['configured', 'auto'] as const)('keeps %s external SFC Tailwind entries owned before SFC style normalization', async (mode) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const entry = path.join(root, 'src/app.css')
    const filename = path.join(root, 'src/app.vue')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    const source = '@import "tailwindcss";\n\npage {\n  background-color: #f6f7fb;\n}\n'
    await fs.writeFile(entry, source)
    await fs.writeFile(filename, '<style src="./app.css"></style>')
    const parsed = await readAndParseSfc(filename, { resolveSrc: {} })
    const compiled = await compileVueStyleToWxss(parsed.descriptor.styles[0]!, { id: 'probe', filename })
    mocks.packageInfo = { version: '4.3.3' }
    const plugin = getPlugins(mode === 'configured' ? { cssEntries: [entry] } : undefined, root)[0]!
    const resolve = vi.fn(async () => ({ id: entry }))
    const request = buildWeappVueStyleRequest(filename, parsed.descriptor.styles[0]!, 0, { hmrToken: 2 })
    const resolved = await getHookHandler(plugin.resolveId)?.call({ resolve } as any, request, undefined, {} as any)

    expect(compiled.code).not.toBe(source)
    expect(resolve).toHaveBeenCalledWith('./app.css', filename.replaceAll('\\', '/'), { skipSelf: true })
    expect(resolved).toBe(request)
    const loaded = await getHookHandler(plugin.load)?.call({} as any, resolved as string)
    expect(loaded).toBeNull()
    const transformed = getHookHandler(plugin.transform)?.call({} as any, compiled.code, resolved as string, {} as any)
    expect(transformed?.code).toContain('managed_tailwindcss_entry_0')
    expect(transformed?.code).not.toContain('@import')
  })

  it('resolves managed SFC styles by block index and alias instead of matching their contents', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwindcss-'))
    temporaryRoots.push(root)
    const filename = path.join(root, 'src/app.vue')
    const entry = path.join(root, 'src/styles/global.css')
    await fs.mkdir(path.dirname(entry), { recursive: true })
    await fs.writeFile(entry, '@import "tailwindcss";')
    await fs.writeFile(filename, '<style>.local { color: red; }</style><style src="@/styles/global.css"></style>')
    const plugin = getPlugins({ cssEntries: [entry] }, root)[0]!
    const resolve = vi.fn(async () => ({ id: entry }))
    const resolveId = getHookHandler(plugin.resolveId)!

    expect(await resolveId.call({ resolve } as any, `${filename}?weapp-vite-vue&type=style&index=0&lang.css`, undefined, {} as any)).toBeNull()
    expect(resolve).not.toHaveBeenCalled()
    const request = `${filename}?weapp-vite-vue&type=style&index=1&lang.css`
    expect(await resolveId.call({ resolve } as any, request, undefined, {} as any)).toBe(request)
    expect(resolve).toHaveBeenCalledWith('@/styles/global.css', filename.replaceAll('\\', '/'), { skipSelf: true })
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
