import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { Entry } from '../../../../../types'
import {
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE,
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_GLOBAL_PATH,
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME,
} from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../../../../runtime/runtimeState'
import { emitCompiledEntryBundleAssets } from './assets'

interface Asset {
  type: 'asset'
  fileName: string
  source: string
}

describe('registered Vue owner final JSON assets', () => {
  it.each([
    ['page', 'override'],
    ['page', 'replace'],
    ['component', 'override'],
    ['component', 'replace'],
  ] as const)('publishes late slot bindings for %s owners with %s merging', async (kind, mergeStrategy) => {
    const relativeBase = `${kind}s/owner/index`
    const filename = `${relativeBase}.vue`
    const declaredJson = { usingComponents: { manual: '/components/manual' }, declaredOnly: true }
    const entry = {
      path: filename,
      type: kind,
      declaredJson,
      json: { ...declaredJson, usingComponents: { ...declaredJson.usingComponents, auto: '/components/auto' } },
    } as unknown as Entry
    const runtimeState = createRuntimeState()
    runtimeState.build.hmr.entriesMap.set(relativeBase, entry)
    const configService = {
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss', js: 'js', json: 'json', wxs: 'wxs' },
      relativeAbsoluteSrcRoot: (id: string) => id,
      weappViteConfig: { json: { mergeStrategy } },
    } as unknown as CompilerContext['configService']
    const ctx = { configService, runtimeState } as CompilerContext
    const bundle: Record<string, Asset> = {}
    const emitted: Asset[] = []
    const pluginCtx = { emitFile: (asset: Asset) => {
      emitted.push(asset)
      bundle[asset.fileName] = asset
    } }
    const compilerConfig = {
      component: kind === 'component',
      navigationBarTitleText: 'compiler-selected',
      usingComponents: { selected: '/components/selected' },
    }
    function compilerResult(withSlots: boolean): VueTransformResult {
      return {
        config: JSON.stringify(compilerConfig),
        ...(withSlots
          ? {
              scopedSlotComponents: [{
                id: 'content',
                componentName: 'slot-content',
                slotKey: 'default',
                template: '<view>scoped content</view>',
                script: 'Component({})',
                bindingManifest: { version: 1, sourceFile: filename, bindings: [], features: {} },
              }],
              slotFallbackWrapperComponent: {
                tagName: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME,
                componentBase: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE,
                template: '<slot />',
                script: 'Component({options:{virtualHost:true,multipleSlots:true}})',
                config: { component: true },
              },
            }
          : {}),
      }
    }
    const publish = (result: VueTransformResult) => emitCompiledEntryBundleAssets({
      bundle,
      pluginCtx,
      ctx,
      filename,
      relativeBase,
      result,
      isPage: kind === 'page',
      configService,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: configService.outputExtensions,
      platformAssetOptions: { platform: 'weapp', templateExtension: 'wxml', scriptModuleExtension: 'wxs' },
    })
    const originalEntry = structuredClone(entry)
    const result = compilerResult(true)
    await publish(result)

    // 通过真实资源阶段追加绑定，再检查 owner 的唯一最终 JSON 发布结果。
    const lateBindings = {
      'slot-content': `/${relativeBase}.__scoped-slot-content`,
      [WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME]: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_GLOBAL_PATH,
    }
    expect(JSON.parse(result.config!)).toEqual({ ...compilerConfig, usingComponents: { ...compilerConfig.usingComponents, ...lateBindings } })
    expect(JSON.parse(bundle[`${relativeBase}.json`]!.source)).toEqual({
      ...compilerConfig,
      usingComponents: { auto: '/components/auto', ...compilerConfig.usingComponents, ...lateBindings },
    })
    for (const generated of [`${relativeBase}.__scoped-slot-content`, WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE]) {
      expect(bundle[`${generated}.wxml`]).toBeDefined()
      expect(JSON.parse(bundle[`${generated}.json`]!.source)).toMatchObject({ component: true })
    }

    // 下一轮删除 slot 后重新合成，不能从上一轮产物复活已移除的绑定。
    await publish(compilerResult(false))
    expect(JSON.parse(bundle[`${relativeBase}.json`]!.source)).toEqual({
      ...compilerConfig,
      usingComponents: { auto: '/components/auto', ...compilerConfig.usingComponents },
    })
    expect(emitted.filter(asset => asset.fileName === `${relativeBase}.json`)).toHaveLength(1)
    expect(entry).toEqual(originalEntry)
  })

  it('keeps native-owned page JSON merging when slot assets create the first compiler config', async () => {
    const relativeBase = 'pages/native-owner/index'
    const configService = { platform: 'weapp', outputExtensions: {}, weappViteConfig: {} } as CompilerContext['configService']
    const ctx = { configService, runtimeState: createRuntimeState() } as CompilerContext
    const bundle: Record<string, Asset> = {
      [`${relativeBase}.json`]: {
        type: 'asset',
        fileName: `${relativeBase}.json`,
        source: JSON.stringify({ navigationBarTitleText: 'native-owned', usingComponents: { manual: '/components/manual' } }),
      },
    }
    await emitCompiledEntryBundleAssets({
      bundle,
      pluginCtx: { emitFile: (asset: Asset) => { bundle[asset.fileName] = asset } },
      ctx,
      filename: `${relativeBase}.vue`,
      relativeBase,
      result: {
        slotFallbackWrapperComponent: {
          tagName: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME,
          componentBase: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE,
          template: '<slot />',
          script: 'Component({})',
          config: { component: true },
        },
      },
      isPage: true,
      configService,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      outputExtensions: {},
      platformAssetOptions: { platform: 'weapp', templateExtension: 'wxml' },
    })
    expect(JSON.parse(bundle[`${relativeBase}.json`]!.source)).toEqual({
      navigationBarTitleText: 'native-owned',
      usingComponents: {
        manual: '/components/manual',
        [WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME]: WEVU_SLOT_FALLBACK_VIRTUAL_HOST_GLOBAL_PATH,
      },
    })
  })
})
