import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createWxmlRemover } from '../../wxml/remove'
import { createOutputFinalizerPlugin, normalizeTemplateAssets } from '../outputFinalizer'
import { collectXmlTemplates } from './wxmlSyntax'

const xml = String.raw`<view title="slash\" data-testid="drop"/><!-- ordinary -->`
const xmlClean = String.raw`<view title="slash\" />`
const legacy = String.raw`<view title="{{ value === \"legacy\" }}" data-testid="drop"/><!-- ordinary -->`
const legacyClean = String.raw`<view title="{{ value === \"legacy\" }}" />`

function createBundle(sources: Record<string, string>): OutputBundle {
  return Object.fromEntries(Object.entries(sources).map(([fileName, source]) => [fileName, {
    type: 'asset',
    fileName,
    source,
    names: [],
    originalFileNames: [],
  }]))
}

function finalize(sources: Record<string, string>) {
  const bundle = createBundle(sources)
  // 无状态入口处理完整产物；增量行为另以真实插件生命周期覆盖。
  const ctx = {
    configService: { platform: 'weapp', weappViteConfig: { wxml: { remove: true } } },
  } as unknown as CompilerContext
  normalizeTemplateAssets(ctx, bundle)
  return bundle
}

function createIncrementalFinalizer() {
  // 使用真实运行状态，仅省略此输出边界不消费的编译服务。
  const ctx = {
    configService: { platform: 'weapp', isDev: true, weappViteConfig: { wxml: { remove: true } } },
    runtimeState: createRuntimeState(),
  } as unknown as CompilerContext
  return { ctx, plugin: createOutputFinalizerPlugin(ctx) }
}

async function runFinalizer(plugin: Plugin, bundle: OutputBundle) {
  const hook = plugin.generateBundle
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) {
    throw new Error('Missing finalizer hook')
  }
  await Reflect.apply(handler, {
    emitFile(asset: EmittedAsset) {
      if (!asset.fileName || asset.source === undefined) {
        throw new Error('Finalized asset requires a filename and source')
      }
      bundle[asset.fileName] = {
        type: 'asset',
        fileName: asset.fileName,
        source: asset.source,
        names: [],
        originalFileNames: [],
      }
      return asset.fileName
    },
  }, [{}, bundle, false])
}

describe('final template compiler syntax ownership', () => {
  it('activates the compiler from app configuration without a runtime flag', () => {
    const bundle = finalize({
      'app.json': '{"componentFramework":"glass-easel"}',
      'pages/index.wxml': xml,
    })
    expect(bundle['pages/index.wxml']).toMatchObject({ source: xmlClean })
  })

  it('keeps page and component opt-ins local instead of selecting a global runtime mode', () => {
    const bundle = finalize({
      'app.json': '{"glassEaselWebview":true}',
      'pages/xml.json': '{"componentFramework":"glass-easel"}',
      'pages/xml.wxml': xml,
      'components/opt-in.json': '{"component":true,"componentFramework":"glass-easel"}',
      'components/opt-in.wxml': xml,
      'pages/legacy.wxml': legacy,
    })
    expect(bundle['pages/xml.wxml']).toMatchObject({ source: xmlClean })
    expect(bundle['components/opt-in.wxml']).toMatchObject({ source: xmlClean })
    expect(bundle['pages/legacy.wxml']).toMatchObject({ source: legacyClean })
  })

  it('follows transitive, generic-default and global component dependencies through cycles', () => {
    const bundle = finalize({
      'app.json': '{"usingComponents":{"global":"/components/global"}}',
      'pages/xml.json': '{"componentFramework":"glass-easel","usingComponents":{"child":"../components/child"}}',
      'pages/xml.wxml': xml,
      'components/child.json': '{"component":true,"componentFramework":"exparser","componentGenerics":{"item":{"default":"./generic"}}}',
      'components/child.wxml': xml,
      'components/generic.json': '{"component":true,"usingComponents":{"cycle":"./child","remote":"plugin://provider/card"}}',
      'components/generic.wxml': xml,
      'components/global.wxml': xml,
      'components/unrelated.wxml': legacy,
    })
    for (const file of ['pages/xml.wxml', 'components/child.wxml', 'components/generic.wxml', 'components/global.wxml']) {
      expect(bundle[file], file).toMatchObject({ source: xmlClean })
    }
    expect(bundle['components/unrelated.wxml']).toMatchObject({ source: legacyClean })
  })

  it('inherits through real import/include edges but not quoted WXS lookalikes', () => {
    const script = '<wxs module="raw">module.exports = \'<import src="./legacy.wxml"/>\';</wxs>'
    const bundle = finalize({
      'pages/xml.json': '{"componentFramework":"glass-easel"}',
      'pages/xml.wxml': `${script}<import src="../shared/imported.wxml"/>${xml}`,
      'shared/imported.wxml': `<include src="./included.wxml"/>${xml}`,
      'shared/included.wxml': xml,
      'pages/legacy.wxml': legacy,
    })
    expect(bundle['pages/xml.wxml']).toMatchObject({ source: `${script}<import src="../shared/imported.wxml"/>${xmlClean}` })
    expect(bundle['shared/imported.wxml']).toMatchObject({ source: `<include src="./included.wxml"/>${xmlClean}` })
    expect(bundle['shared/included.wxml']).toMatchObject({ source: xmlClean })
    expect(bundle['pages/legacy.wxml']).toMatchObject({ source: legacyClean })
  })

  it('retains partial HMR inputs and replaces changed JSON without using output fingerprints', async () => {
    const { ctx, plugin } = createIncrementalFinalizer()
    await runFinalizer(plugin, createBundle({
      'app.json': '{}',
      'pages/index.json': '{"componentFramework":"glass-easel"}',
      'pages/index.wxml': xml,
    }))
    ctx.runtimeState.build.hmr.profile.event = 'change'
    const updated = createBundle({ 'pages/index.wxml': xml.replace('/>', '>updated</view>') })
    await runFinalizer(plugin, updated)
    expect(updated['pages/index.wxml']).toMatchObject({ source: xmlClean.replace('/>', '>updated</view>') })
    const changedConfig = createBundle({ 'pages/index.json': '{}', 'pages/index.wxml': legacy })
    await runFinalizer(plugin, changedConfig)
    expect(changedConfig['pages/index.wxml']).toMatchObject({ source: legacyClean })
  })

  it('drops absent compiler facts when a full output replaces a previous snapshot', async () => {
    const { ctx, plugin } = createIncrementalFinalizer()
    await runFinalizer(plugin, createBundle({
      'pages/index.json': '{"componentFramework":"glass-easel"}',
      'pages/index.wxml': xml,
    }))
    ctx.runtimeState.build.hmr.profile.event = 'change'
    ctx.runtimeState.build.hmr.didEmitAllEntries = true
    const replaced = createBundle({ 'pages/index.wxml': legacy })
    await runFinalizer(plugin, replaced)
    expect(replaced['pages/index.wxml']).toMatchObject({ source: legacyClean })
  })

  it('keeps binary config and import inputs as UTF-8 across partial output updates', async () => {
    const { ctx, plugin } = createIncrementalFinalizer()
    const first = createBundle({
      'app.json': '{}',
      'pages/xml.json': '{"componentFramework":"glass-easel"}',
      'pages/xml.wxml': '<include src="../shared/part.wxml"/>',
      'shared/part.wxml': xml,
      'assets/data.json': '{"label":"example"}',
      'assets/opaque.json': 'unrelated copied payload',
    })
    for (const fileName of ['app.json', 'pages/xml.json', 'pages/xml.wxml', 'assets/data.json', 'assets/opaque.json']) {
      const asset = first[fileName]
      if (asset?.type === 'asset') {
        asset.source = Buffer.from(String(asset.source))
      }
    }
    await runFinalizer(plugin, first)
    ctx.runtimeState.build.hmr.profile.event = 'change'
    const updated = createBundle({ 'shared/part.wxml': xml.replace('/>', '>updated</view>') })
    await runFinalizer(plugin, updated)
    expect(updated['shared/part.wxml']).toMatchObject({ source: xmlClean.replace('/>', '>updated</view>') })
  })

  it('fixes compiler ownership before optional subtree removal regardless of asset order', () => {
    const sources = {
      'pages/xml.json': '{"componentFramework":"glass-easel"}',
      'pages/xml.wxml': '<view><include src="../shared/part.wxml"/></view>',
      'shared/part.wxml': String.raw`<text title="slash\"/><!-- ordinary -->`,
    }
    for (const entries of [Object.entries(sources), Object.entries(sources).reverse()]) {
      const bundle = createBundle(Object.fromEntries(entries))
      // 只删除父节点；依赖模板本身仍作为最终产物存在。
      const ctx = {
        configService: { platform: 'weapp', weappViteConfig: { wxml: { remove: { tag: ['view'], comment: true } } } },
      } as unknown as CompilerContext
      normalizeTemplateAssets(ctx, bundle)
      expect(bundle['pages/xml.wxml']).toMatchObject({ source: '' })
      expect(bundle['shared/part.wxml']).toMatchObject({ source: String.raw`<text title="slash\"/>` })
    }
  })

  it('respects plugin compiler roots independently of the enclosing application', () => {
    const bundle = finalize({
      'app.json': '{"componentFramework":"glass-easel"}',
      'pages/index.wxml': xml,
      'plugin/plugin.json': '{}',
      'plugin/components/card.wxml': legacy,
    })
    expect(bundle['pages/index.wxml']).toMatchObject({ source: xmlClean })
    expect(bundle['plugin/components/card.wxml']).toMatchObject({ source: legacyClean })
    expect(finalize({ 'plugin.json': '{"componentFramework":"glass-easel"}', 'components/card.wxml': xml })['components/card.wxml'])
      .toMatchObject({ source: xmlClean })
  })

  it('inherits app compiler activation before independent outputs have a main snapshot', () => {
    const sources = new Map([['independent/index.wxml', xml]])
    // 独立编译实例的既有 app 配置可用，但主包尚未进入输出缓存。
    const ctx = {
      scanService: { appEntry: { json: { componentFramework: 'glass-easel' } } },
    } as unknown as CompilerContext
    const meta = { subPackage: { root: 'independent' } } as SubPackageMetaValue
    const selected = collectXmlTemplates(ctx, sources, meta)
    const remove = createWxmlRemover({ attr: ['data-testid'], comment: true })
    expect(remove(xml, 'independent/index.wxml', selected.has('independent/index.wxml') ? 'xml' : 'legacy'))
      .toBe(xmlClean)
  })

  it('does not leak independent opt-ins or app-global components across build scopes', () => {
    const previous = new Map([
      ['app.json', '{"usingComponents":{"global":"/components/global"}}'],
      ['independent/index.json', '{"componentFramework":"glass-easel"}'],
      ['independent/index.wxml', xml],
      ['components/global.wxml', legacy],
    ])
    // 作用域判断复用扫描服务；依赖闭包只消费明确的 UTF-8 编译输入。
    const ctx = {
      scanService: { isMainPackageFileName: (name: string) => !name.startsWith('independent/') },
    } as unknown as CompilerContext
    const main = collectXmlTemplates(ctx, previous)
    const independent = collectXmlTemplates(ctx, previous, { subPackage: { root: 'independent' } } as SubPackageMetaValue)
    expect(main.has('components/global.wxml')).toBe(false)
    expect(independent.has('independent/index.wxml')).toBe(true)
    expect(independent.has('components/global.wxml')).toBe(false)
  })
})
