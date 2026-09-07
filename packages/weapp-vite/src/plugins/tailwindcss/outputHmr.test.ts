import type { OutputAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import path from 'node:path'
import postcss from 'postcss'
import { describe, expect, it, vi } from 'vitest'
import { css } from '../css'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

const mocks = vi.hoisted(() => ({ createCompiler: vi.fn() }))
vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))

async function generate(plugin: Plugin, bundle: OutputBundle) {
  const hook = plugin.generateBundle!
  const handler = typeof hook === 'function' ? hook : hook.handler
  await handler.call({
    addWatchFile: vi.fn(),
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
    generate: vi.fn(async () => ({ css: '.updated { color: red; }', snapshot, dependencies: [] })),
    mergeSnapshots: vi.fn(() => snapshot),
    transformCss: vi.fn(async (source: string) => ({ css: source })),
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
    runtimeState: {
      css: {
        emittedSource: new Map(),
        importerToDependencies: new Map(),
        dependencyToImporters: new Map(),
        sidecarImports: new Set(),
      },
      build: { hmr: { profile: {} as { event?: string, dirtyReasonSummary?: string[] } } },
    },
  }
  const [manager, output] = createTailwindcssPlugin(ctx as any)
  const owner = css(ctx as any)[0]!
  return { cwd, ctx, compiler, manager: manager!, output: output!, owner, snapshot }
}

function declarations(bundle: OutputBundle, selector: string, property: string) {
  const values: string[] = []
  postcss.parse(String((bundle['app.wxss'] as OutputAsset).source)).walkRules(selector, rule =>
    rule.walkDecls(property, (declaration) => { values.push(declaration.value) }))
  return values
}

describe('Tailwind content HMR through the CSS owner', () => {
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
    compiler.generate.mockResolvedValueOnce({ css: '.updated { color: blue; }', snapshot, dependencies: [] })
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
