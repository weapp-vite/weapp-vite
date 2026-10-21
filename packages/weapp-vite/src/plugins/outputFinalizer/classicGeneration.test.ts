import type { EmittedAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../context'
import { Buffer } from 'node:buffer'
import { WEAPP_VITE_CLASSIC_GENERATION_MARKER } from '@weapp-core/constants'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { resolveOutputChunkTransformCode } from '../../utils/outputChunk'
import { prepareClassicOutputGeneration, shouldPublishClassicGeneration } from './classicGeneration'

const root = path.resolve('classic-generation-fixture')

function context() {
  return {
    currentBuildTarget: 'app',
    configService: {
      isDev: true,
      platform: 'weapp',
      weappViteConfig: { hmr: { runtime: 'classic' } },
      projectPrivateConfig: { setting: { compileHotReLoad: true } },
    },
    runtimeState: createRuntimeState(),
  } as CompilerContext
}

function bundle(files: Record<string, string> = {}) {
  return {
    'app.js': { type: 'chunk', fileName: 'app.js', isEntry: true, code: 'App({})\n' },
    ...Object.fromEntries(Object.entries(files).map(([fileName, source]) => [fileName, { type: 'asset', fileName, source }])),
  } as OutputBundle
}

function digest(output: OutputBundle) {
  const code = (output['app.js'] as OutputChunk).code
  const matches = [...code.matchAll(new RegExp(`${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:([a-f0-9]{64})`, 'g'))]
  expect(matches).toHaveLength(1)
  return matches[0][1]
}

function prepare(ctx: CompilerContext, output: OutputBundle, options: {
  partial?: boolean
  independentOutputs?: EmittedAsset[]
  publicOutputs?: EmittedAsset[]
  outDir?: string
} = {}) {
  const commit = prepareClassicOutputGeneration(ctx, options.outDir ?? root, output, {
    partial: options.partial ?? false,
    independentOutputNames: options.independentOutputs?.map(item => item.fileName!) ?? [],
    independentOutputs: options.independentOutputs ?? [],
    publicOutputs: options.publicOutputs ?? [],
  })
  return { commit, digest: digest(output) }
}

function javascriptWithMap(code: string, source: string) {
  const map = { version: 3, names: [], sources: ['entry.ts'], sourcesContent: [source], mappings: 'AAAA' }
  return `${code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
}

describe('classic native generation', () => {
  it('is deterministic, replaces its own marker and preserves inline mappings', () => {
    const ctx = context()
    const output = bundle({ 'pages/home/index.wxml': '<view>one</view>' })
    const app = output['app.js'] as OutputChunk
    app.code = javascriptWithMap('App({})', 'original source')
    const first = prepare(ctx, output)
    expect(getHmrRuntimeSession(ctx).outputGenerations.size).toBe(0)
    first.commit()
    const second = prepare(ctx, output)
    expect(second.digest).toBe(first.digest)
    expect(app.map).toMatchObject({ version: 3, sourcesContent: ['original source'] })
    expect(resolveOutputChunkTransformCode(app)).toContain('App({})')
    expect(app.code).toContain('sourceMappingURL=data:application/json')
  })

  it('merges partial outputs and retires or restores files only for a full publication', () => {
    const ctx = context()
    const original = { 'pages/a/index.wxml': '<view>A</view>', 'pages/b/index.wxml': '<view>B</view>' }
    const first = prepare(ctx, bundle(original))
    first.commit()
    const same = prepare(ctx, bundle({ 'pages/a/index.wxml': original['pages/a/index.wxml'] }), { partial: true })
    expect(same.digest).toBe(first.digest)
    same.commit()
    const changed = prepare(ctx, bundle({ 'pages/a/index.wxml': '<view>updated</view>' }), { partial: true })
    expect(changed.digest).not.toBe(first.digest)
    changed.commit()
    const restored = prepare(ctx, bundle(original))
    expect(restored.digest).toBe(first.digest)
    restored.commit()
    const removed = prepare(ctx, bundle({ 'pages/a/index.wxml': original['pages/a/index.wxml'] }))
    expect(removed.digest).not.toBe(first.digest)
    removed.commit()
    expect(prepare(ctx, bundle(original)).digest).toBe(first.digest)
  })

  it('includes public bytes and independent generations but excludes diagnostic maps', () => {
    const ctx = context()
    const publicFile = { type: 'asset', fileName: 'public/icon.bin', source: new Uint8Array([1, 2]) } as EmittedAsset
    const independent = { type: 'asset', fileName: 'pkg/page.js', source: javascriptWithMap('Page({})', 'first map') } as EmittedAsset
    const mappedBundle = (source: string) => {
      const output = bundle({ 'app.js.map': source })
      const app = output['app.js'] as OutputChunk
      app.sourcemapFileName = 'app.js.map'
      return output
    }
    const initial = prepare(ctx, mappedBundle('first map'), { publicOutputs: [publicFile], independentOutputs: [independent] })
    initial.commit()
    const mapOnly = prepare(ctx, mappedBundle('second map'), {
      partial: true,
      publicOutputs: [publicFile],
      independentOutputs: [{ ...independent, source: javascriptWithMap('Page({})', 'changed map') }],
    })
    expect(mapOnly.digest).toBe(initial.digest)
    expect(prepare(ctx, bundle(), { partial: true, publicOutputs: [{ ...publicFile, source: new Uint8Array([1, 3]) }], independentOutputs: [independent] }).digest).not.toBe(initial.digest)
    expect(prepare(ctx, bundle(), { partial: true, publicOutputs: [publicFile] }).digest).not.toBe(initial.digest)
    expect(prepare(ctx, bundle(), { partial: true, independentOutputs: [independent] }).digest).not.toBe(initial.digest)
  })

  it('includes public map files and compiled map data without a source mapping relationship', () => {
    const ctx = context()
    const publicMap = { type: 'asset', fileName: 'data.map', source: 'first public data' } as EmittedAsset
    const initial = prepare(ctx, bundle({ 'compiled-data.map': 'first compiled data' }), { publicOutputs: [publicMap] })
    initial.commit()
    expect(prepare(ctx, bundle(), { partial: true, publicOutputs: [{ ...publicMap, source: 'changed public data' }] }).digest).not.toBe(initial.digest)
    expect(prepare(ctx, bundle({ 'compiled-data.map': 'changed compiled data' }), { partial: true, publicOutputs: [publicMap] }).digest).not.toBe(initial.digest)
  })

  it('excludes relative external source maps identified by script references', () => {
    const ctx = context()
    const mappedBundle = (source: string) => bundle({
      'pkg/page.js': 'Page({})\n//# sourceMappingURL=../maps/page.js.map',
      'maps/page.js.map': source,
    })
    const initial = prepare(ctx, mappedBundle('first map'))
    initial.commit()
    expect(prepare(ctx, mappedBundle('changed map')).digest).toBe(initial.digest)
  })

  it('normalizes independent chunk and emitted asset representations', () => {
    const ctx = context()
    const output = { type: 'chunk', fileName: 'pkg/page.js', code: javascriptWithMap('Page({})', 'source') } as OutputChunk
    const firstBundle = bundle()
    const commit = prepareClassicOutputGeneration(ctx, root, firstBundle, {
      partial: false,
      independentOutputNames: [output.fileName],
      independentOutputs: [output],
      publicOutputs: [],
    })
    commit()
    const second = prepare(ctx, bundle(), {
      partial: true,
      independentOutputs: [{ type: 'asset', fileName: output.fileName, source: output.code }],
    })
    expect(second.digest).toBe(digest(firstBundle))
  })

  it('keeps only successful command-scoped baselines across context replacement', () => {
    const ctx = context()
    const first = prepare(ctx, bundle({ 'pages/home/index.wxml': 'original' }))
    first.commit()
    prepare(ctx, bundle({ 'pages/home/index.wxml': 'abandoned' }))
    const replacement = context()
    attachHmrRuntimeSession(replacement, getHmrRuntimeSession(ctx))
    expect(prepare(replacement, bundle(), { partial: true }).digest).toBe(first.digest)
    expect(prepare(replacement, bundle(), { partial: true, outDir: path.join(root, 'other') }).digest).not.toBe(first.digest)
    expect(getHmrRuntimeSession(context()).outputGenerations.size).toBe(0)
  })

  it('requires the current native app chunk rather than using a stale disk entry', () => {
    expect(() => prepare(context(), {})).toThrow('缺少 app.js 根入口')
  })

  it('uses the effective decision even when a classic command has the initial stateful session phase', () => {
    const ctx = context()
    expect(getHmrRuntimeSession(ctx).phase).toBe('stateful')
    expect(shouldPublishClassicGeneration(ctx)).toBe(true)
    ctx.configService.weappViteConfig.hmr!.runtime = 'stateful-experimental'
    expect(shouldPublishClassicGeneration(ctx)).toBe(false)
    getHmrRuntimeSession(ctx).requestClassic({ code: 'native-registration', message: 'fixture fallback' })
    expect(shouldPublishClassicGeneration(ctx)).toBe(true)
  })

  it('uses the same default app target as core and asset plugins', () => {
    const ctx = context()
    ctx.currentBuildTarget = undefined
    expect(shouldPublishClassicGeneration(ctx)).toBe(true)
    ctx.currentBuildTarget = 'plugin'
    expect(shouldPublishClassicGeneration(ctx)).toBe(false)
  })

  it.each([
    { isDev: false },
    { platform: 'alipay' },
    { pluginOnly: true },
    { weappLibConfig: { enabled: true } },
  ])('excludes unsupported build scopes: %j', (overrides) => {
    const ctx = context()
    Object.assign(ctx.configService, overrides)
    expect(shouldPublishClassicGeneration(ctx)).toBe(false)
  })
})
