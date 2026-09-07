import type { OutputAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import postcss from 'postcss'
import { describe, expect, it, vi } from 'vitest'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker, createManagedTailwindcssOutputMarker } from '../tailwindcssMarker'

const mocks = vi.hoisted(() => ({ createCompiler: vi.fn() }))

vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))

async function generate(plugin: Plugin, bundle: OutputBundle) {
  const hook = plugin.generateBundle!
  const handler = typeof hook === 'function' ? hook : hook.handler
  await handler.call({ addWatchFile: vi.fn() } as any, {} as any, bundle as any, false)
}

function createFixture(cssEntries = ['src/app.css']) {
  const cwd = path.resolve('tailwind-output-fixture')
  const snapshot = { classSet: new Set(['text-xl']), roots: [], sources: [], target: 'weapp' }
  const generatedCss = ':root { --text-xl--line-height: 1.4; } .text-xl { font-size: 40rpx; line-height: var(--tw-leading, var(--text-xl--line-height)); }'
  const compiler = {
    generate: vi.fn(async () => ({ css: generatedCss, snapshot, dependencies: [] })),
    mergeSnapshots: vi.fn(() => snapshot),
    transformCss: vi.fn(async (css: string) => ({ css })),
    invalidate: vi.fn(),
  }
  mocks.createCompiler.mockReturnValue(compiler)
  const plugins = createTailwindcssPlugin({
    configService: {
      absoluteSrcRoot: path.join(cwd, 'src'),
      cwd,
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      platform: 'weapp',
      relativeOutputPath: (file: string) => path.relative(path.join(cwd, 'src'), file),
      weappViteConfig: { tailwindcss: { cssEntries } },
    },
  } as any)
  return { compiler, plugins, snapshot }
}

function stylesheet(source: string, fileName = 'app.wxss') {
  return { type: 'asset', fileName, source } as OutputAsset
}

function readDeclarations(bundle: OutputBundle, selector: string, property: string, fileName = 'app.wxss') {
  const ast = postcss.parse(String((bundle[fileName] as OutputAsset).source))
  const values: string[] = []
  ast.walkRules(selector, (rule) => {
    rule.walkDecls(property, (declaration) => {
      values.push(declaration.value)
    })
  })
  return values
}

describe('managed Tailwind output ownership', () => {
  it.each(['same asset', 'reemitted asset', 'renamed asset'] as const)('injects each utility once after %s', async (mode) => {
    const { compiler, plugins } = createFixture()
    const bundle = {
      'app.wxss': stylesheet(`${createManagedTailwindcssEntryMarker(0)}\n.author { color: red; }`),
    } as OutputBundle

    await generate(plugins[0]!, bundle)
    expect(compiler.generate).not.toHaveBeenCalled()
    expect((bundle['app.wxss'] as OutputAsset).source).toContain(createManagedTailwindcssOutputMarker(0))
    let fileName = 'app.wxss'
    if (mode !== 'same asset') {
      // CSS owner 的 emitFile 会产生新 asset；语义不能依赖 pre hook 中的对象身份。
      fileName = mode === 'renamed asset' ? 'pages/index/index.wxss' : fileName
      const previous = bundle['app.wxss'] as OutputAsset
      delete bundle['app.wxss']
      bundle[fileName] = stylesheet(`${previous.source}\n.late-author { color: blue; }`, fileName)
    }
    await generate(plugins[1]!, bundle)

    expect(readDeclarations(bundle, '.text-xl', 'line-height', fileName)).toEqual(['var(--tw-leading, var(--text-xl--line-height))'])
    expect(readDeclarations(bundle, ':root', '--text-xl--line-height', fileName)).toEqual(['1.4'])
    expect(readDeclarations(bundle, '.author', 'color', fileName)).toEqual(['red'])
    if (mode !== 'same asset') {
      expect(readDeclarations(bundle, '.late-author', 'color', fileName)).toEqual(['blue'])
    }
    expect(String((bundle[fileName] as OutputAsset).source)).not.toMatch(/managed[-_]tailwindcss/)
    expect(compiler.generate).toHaveBeenCalledOnce()
    expect(compiler.transformCss).toHaveBeenCalledOnce()
  })

  it('merges repeated entry references without duplicating utility rules or modifying binary assets', async () => {
    const { compiler, plugins, snapshot } = createFixture(['src/app.css', 'src/theme.css'])
    compiler.generate
      .mockResolvedValueOnce({ css: '.gap-4 { gap: 32rpx; }', snapshot, dependencies: [] })
      .mockResolvedValueOnce({ css: '.text-lg { font-size: 36rpx; }', snapshot, dependencies: [] })
    const logo = Buffer.from([0x89, 0x50, 0x00, 0xFF])
    const bundle = {
      'app.wxss': stylesheet([0, 1, 0].map(createManagedTailwindcssEntryMarker).join('\n')),
      'logo.png': { type: 'asset', fileName: 'logo.png', source: logo },
    } as unknown as OutputBundle

    await generate(plugins[0]!, bundle)
    await generate(plugins[1]!, bundle)

    expect(readDeclarations(bundle, '.gap-4', 'gap')).toEqual(['32rpx'])
    expect(readDeclarations(bundle, '.text-lg', 'font-size')).toEqual(['36rpx'])
    expect((bundle['logo.png'] as OutputAsset).source).toBe(logo)
    expect(compiler.generate).toHaveBeenCalledTimes(2)
    expect(compiler.transformCss).toHaveBeenCalledOnce()
  })

  it('generates fresh utilities from a cached pending owner after a content update', async () => {
    const { compiler, plugins, snapshot } = createFixture()
    compiler.generate.mockResolvedValueOnce({ css: '.gap-4 { gap: 32rpx; }', snapshot, dependencies: [] })
    const bundle = { 'app.wxss': stylesheet(createManagedTailwindcssEntryMarker(0)) } as OutputBundle
    await generate(plugins[0]!, bundle)
    const pendingOwner = String((bundle['app.wxss'] as OutputAsset).source)
    await generate(plugins[1]!, bundle)
    expect(readDeclarations(bundle, '.gap-4', 'gap')).toEqual(['32rpx'])

    await plugins[0]!.watchChange?.call({} as any, path.resolve('tailwind-output-fixture/src/page.wxml'), { event: 'update' } as any)
    compiler.generate.mockResolvedValueOnce({ css: '.gap-8 { gap: 64rpx; }', snapshot, dependencies: [] })
    const updated = { 'app.wxss': stylesheet(pendingOwner) } as OutputBundle
    await generate(plugins[0]!, updated)
    await generate(plugins[1]!, updated)

    expect(readDeclarations(updated, '.gap-4', 'gap')).toEqual([])
    expect(readDeclarations(updated, '.gap-8', 'gap')).toEqual(['64rpx'])
    expect(compiler.invalidate).toHaveBeenCalledOnce()
    expect(compiler.generate).toHaveBeenCalledTimes(2)
    expect(String((updated['app.wxss'] as OutputAsset).source)).not.toMatch(/managed[-_]tailwindcss/)
  })
})
