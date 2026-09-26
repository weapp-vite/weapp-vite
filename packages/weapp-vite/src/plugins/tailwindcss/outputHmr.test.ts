import type { OutputAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import path from 'node:path'
import postcss from 'postcss'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

const mocks = vi.hoisted(() => ({ createCompiler: vi.fn() }))
vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))

async function generate(plugin: Plugin | Plugin[], bundle: OutputBundle, imports?: Map<string, string[]>) {
  if (Array.isArray(plugin)) {
    for (const entry of plugin) {
      await generate(entry, bundle, imports)
    }
    return
  }
  const hook = plugin.generateBundle!
  const handler = typeof hook === 'function' ? hook : hook.handler
  await handler.call({
    addWatchFile: vi.fn(),
    getModuleInfo: (id: string) => imports?.has(id) ? { importedIds: imports.get(id)! } : null,
    emitFile(asset: OutputAsset) {
      bundle[asset.fileName] = asset
      return asset.fileName
    },
  } as any, {} as any, bundle as any, false)
}

function fixture(entry: string) {
  const cwd = path.resolve('tailwind-output-hmr-fixture')
  const snapshot = { classSet: new Set(), roots: [], sources: [], target: 'weapp' }
  const compiler = {
    generate: vi.fn(async () => ({ css: '.updated { color: red; }', rawCss: '.updated { color: red; }', snapshot, dependencies: [] })),
    mergeSnapshots: vi.fn(() => snapshot),
    transformCss: vi.fn(async (source: string) => ({ css: source })),
    transformJavaScript: vi.fn(async (code: string) => ({ code })),
    invalidate: vi.fn(),
  }
  mocks.createCompiler.mockReturnValue(compiler)
  const ctx = {
    configService: {
      cwd,
      absoluteSrcRoot: path.join(cwd, 'src'),
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      relativeOutputPath: (file: string) => path.relative(path.join(cwd, 'src'), file),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(path.join(cwd, 'src'), file),
      weappViteConfig: { tailwindcss: { cssEntries: [entry] } },
    },
    scanService: { subPackageMap: new Map() },
    runtimeState: createRuntimeState(),
  }
  const [manager, output] = createTailwindcssPlugin(ctx as any)
  const owner = css(ctx as any)[0]!
  return { cwd, ctx, compiler, manager: manager!, output: [createOutputFinalizerPlugin(ctx as any), output!, createOutputPublicationPlugin(ctx as any)], owner, snapshot }
}

function declarations(bundle: OutputBundle, selector: string, property: string) {
  const values: string[] = []
  postcss.parse(String((bundle['app.wxss'] as OutputAsset).source)).walkRules(selector, rule =>
    rule.walkDecls(property, (declaration) => { values.push(declaration.value) }))
  return values
}

describe('Tailwind content HMR through the CSS owner', () => {
  it.each([
    ['src/app.css', true, false],
    ['src/app.css', false, false],
    ['src/styles/tailwind.css', true, false],
    ['src/styles/tailwind.css', false, false],
    ['src/styles/tailwind.css', false, true],
  ] as const)('preserves the complete owner of %s when a content update omits its CSS (profile hints: %s)', async (entry, dirty, includesOwner) => {
    const { cwd, ctx, compiler, manager, owner, output, snapshot } = fixture(entry)
    const initial = {
      'assets/owner.css': {
        type: 'asset',
        fileName: 'assets/owner.css',
        originalFileNames: [path.join(cwd, 'src/app.ts')],
        source: `@import "./shared.wxss";\n.before { color: green; }\n${createManagedTailwindcssEntryMarker(0)}\n.after { color: purple; }`,
      },
    } as OutputBundle
    await generate(manager, initial)
    await generate(owner, initial)
    await generate(output, initial)
    expect(declarations(initial, '.updated', 'color')).toEqual(['red'])

    ctx.runtimeState.build.hmr.profile = { event: 'update', dirtyReasonSummary: dirty ? ['tailwind-content:1'] : ['entry-direct:1'] }
    compiler.generate.mockResolvedValueOnce({ css: '.updated { color: blue; }', rawCss: '.updated { color: blue; }', snapshot, dependencies: [] })
    const updated = {
      'pages/index/index.js': { type: 'chunk', fileName: 'pages/index/index.js', code: 'export {}' },
      ...(includesOwner ? { 'app.js': { type: 'chunk', fileName: 'app.js', facadeModuleId: path.join(cwd, 'src/app.ts'), code: 'App({})' } } : {}),
    } as unknown as OutputBundle
    await generate(manager, updated)
    await generate(owner, updated, new Map([
      [path.join(cwd, 'src/app.ts'), [path.join(cwd, entry)]],
      [path.join(cwd, entry), []],
    ]))
    await generate(output, updated)

    expect(updated['app.wxss']).toBeDefined()
    expect(declarations(updated, '.updated', 'color')).toEqual(['blue'])
    expect(declarations(updated, '.before', 'color')).toEqual(['green'])
    expect(declarations(updated, '.after', 'color')).toEqual(['purple'])
    expect(String((updated['app.wxss'] as OutputAsset).source)).toContain('@import "./shared.wxss";')
    expect(updated['styles/tailwind.wxss']).toBeUndefined()
    expect(Object.values(updated).filter(asset => asset.type === 'asset')).toHaveLength(1)
  })

  it.each([true, false])('does not publish unchanged final CSS during a script update (profile hints: %s)', async (dirty) => {
    const { cwd, ctx, manager, owner, output } = fixture('src/styles/tailwind.css')
    const initial = {
      'assets/owner.css': {
        type: 'asset',
        fileName: 'assets/owner.css',
        originalFileNames: [path.join(cwd, 'src/app.ts')],
        source: createManagedTailwindcssEntryMarker(0),
      },
    } as OutputBundle
    await generate(manager, initial)
    await generate(owner, initial)
    await generate(output, initial)
    const source = String((initial['app.wxss'] as OutputAsset).source)

    for (const eventId of ['first-update', 'second-update']) {
      ctx.runtimeState.build.hmr.profile = { event: 'update', eventId, dirtyReasonSummary: dirty ? ['tailwind-content:1'] : ['entry-direct:1'] }
      const updated = {
        'pages/index/index.js': { type: 'chunk', fileName: 'pages/index/index.js', code: `Page({ update: '${eventId}' })` },
      } as unknown as OutputBundle
      await generate(manager, updated)
      await generate(owner, updated)
      await generate(output, updated)
      expect(updated['app.wxss']).toBeUndefined()
      expect(ctx.runtimeState.build.output.emittedSource.get('app.wxss')).toBe(source)
    }
  })

  it.each(['.author { color: green; }', ''])('does not restore a removed managed entry after its owner emits %j', async (source) => {
    const { cwd, ctx, manager, owner, output } = fixture('src/styles/tailwind.css')
    const ownerBundle = (cssSource: string) => ({
      'assets/owner.css': {
        type: 'asset',
        fileName: 'assets/owner.css',
        originalFileNames: [path.join(cwd, 'src/app.ts')],
        source: cssSource,
      },
    }) as OutputBundle
    const initial = ownerBundle(createManagedTailwindcssEntryMarker(0))
    await generate(manager, initial)
    await generate(owner, initial)
    await generate(output, initial)
    expect(declarations(initial, '.updated', 'color')).toEqual(['red'])

    ctx.runtimeState.build.hmr.profile = { event: 'update', dirtyReasonSummary: ['entry-direct:1'] }
    const replaced = ownerBundle(source)
    await generate(manager, replaced)
    await generate(owner, replaced)
    await generate(output, replaced)
    expect(String((replaced['app.wxss'] as OutputAsset).source)).toBe(source)

    const updated = {
      'pages/index/index.js': { type: 'chunk', fileName: 'pages/index/index.js', code: 'export {}' },
    } as unknown as OutputBundle
    await generate(manager, updated)
    await generate(owner, updated)
    await generate(output, updated)
    expect(updated['app.wxss']).toBeUndefined()
  })

  it('clears a managed owner after its last stylesheet import is removed', async () => {
    const { cwd, ctx, manager, owner, output } = fixture('src/styles/tailwind.css')
    const app = path.join(cwd, 'src/app.ts')
    const initial = {
      'assets/owner.css': {
        type: 'asset',
        fileName: 'assets/owner.css',
        originalFileNames: [app],
        source: createManagedTailwindcssEntryMarker(0),
      },
    } as OutputBundle
    await generate(manager, initial)
    await generate(owner, initial)
    await generate(output, initial)
    expect(declarations(initial, '.updated', 'color')).toEqual(['red'])

    ctx.runtimeState.build.hmr.profile = { event: 'update', dirtyReasonSummary: ['entry-direct:1'] }
    const removed = {
      'app.js': { type: 'chunk', fileName: 'app.js', facadeModuleId: app, code: 'App({})', viteMetadata: { importedCss: new Set() } },
    } as unknown as OutputBundle
    await generate(manager, removed)
    await generate(owner, removed, new Map([[app, []]]))
    await generate(output, removed)
    expect(String((removed['app.wxss'] as OutputAsset).source)).toBe('')

    const updated = {
      'pages/index/index.js': { type: 'chunk', fileName: 'pages/index/index.js', code: 'export {}' },
    } as unknown as OutputBundle
    await generate(manager, updated)
    await generate(owner, updated)
    await generate(output, updated)
    expect(updated['app.wxss']).toBeUndefined()
  })

  it.each([
    ['canonical', 'src/app.css', true],
    ['canonical without profile hints', 'src/app.css', false],
    ['merged noncanonical', 'src/styles/tailwind.css', true],
    ['merged noncanonical without profile hints', 'src/styles/tailwind.css', false],
  ] as const)('keeps pending generation for %s', async (_name, entry, dirty) => {
    const { cwd, ctx, compiler, manager, owner, output, snapshot } = fixture(entry)
    const merged = entry !== 'src/app.css'
    const pendingBundle = () => {
      const fileName = merged ? 'assets/owner.css' : 'app.wxss'
      return {
        [fileName]: {
          type: 'asset',
          fileName,
          originalFileNames: [path.join(cwd, merged ? 'src/app.ts' : entry)],
          source: `.author { color: green; }\n${createManagedTailwindcssEntryMarker(0)}`,
        },
      } as OutputBundle
    }

    const initial = pendingBundle()
    await generate(manager, initial)
    await generate(owner, initial)
    await generate(output, initial)
    expect(declarations(initial, '.updated', 'color')).toEqual(['red'])

    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      dirtyReasonSummary: dirty ? ['tailwind-content:1'] : ['entry-direct:1'],
    }
    compiler.generate.mockResolvedValueOnce({ css: '.updated { color: blue; }', rawCss: '.updated { color: blue; }', snapshot, dependencies: [] })
    const updated = pendingBundle()
    await generate(manager, updated)
    await generate(owner, updated)
    expect(updated['app.wxss'], 'CSS owner must retain pending generated content').toBeDefined()
    await generate(output, updated)

    expect(declarations(updated, '.updated', 'color')).toEqual(['blue'])
    expect(declarations(updated, '.author', 'color')).toEqual(['green'])
    expect(String((updated['app.wxss'] as OutputAsset).source)).not.toMatch(/managed[-_]tailwindcss/)
    expect(compiler.generate).toHaveBeenCalledTimes(2)
  })

  it('still suppresses unchanged final author styles', async () => {
    const { ctx, owner } = fixture('src/styles/tailwind.css')
    const source = '.author { color: green; }'
    ctx.runtimeState.build.hmr.profile = { event: 'update', dirtyReasonSummary: ['entry-direct:1'] }
    ctx.runtimeState.css.emittedSource.set('pages/index/index.wxss', source)
    const bundle = {
      'pages/index/index.wxss': { type: 'asset', fileName: 'pages/index/index.wxss', source },
    } as OutputBundle
    await generate(owner, bundle)
    expect(bundle).toEqual({})
  })
})
