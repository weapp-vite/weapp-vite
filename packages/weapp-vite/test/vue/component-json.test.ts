import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import { callPluginHook } from '../pluginHook'
import { captureTestNativeEntryAssetOwners, createTestModuleGraphService, createTestRuntimeState } from './moduleGraph'

function createCtx(pages: string[] = []) {
  const cwd = '/root'
  const absoluteSrcRoot = '/root/src'
  const appEntry = { json: { pages } }
  return {
    moduleGraphService: createTestModuleGraphService(),
    runtimeState: createTestRuntimeState(),
    configService: {
      cwd,
      absoluteSrcRoot,
      relativeOutputPath(absoluteBase: string) {
        if (!absoluteBase.startsWith(`${absoluteSrcRoot}/`)) {
          return undefined
        }
        return absoluteBase.slice(absoluteSrcRoot.length + 1).replace(/\\/g, '/')
      },
    },
    scanService: {
      appEntry,
      loadAppEntry: async () => appEntry,
      loadSubPackages: () => [],
    },
  } as any
}

describe('vue transform emits default component json', () => {
  it('emits { component: true } for Vue SFC components without config', async () => {
    const ctx = createCtx(['pages/home/index'])
    const plugin = createVueTransformPlugin(ctx)
    const file = '/root/src/components/foo/index.vue'

    await callPluginHook(plugin.transform as any, {}, `<template><view>ok</view></template><script setup>const a = 1</script>`, file)

    const emitted: Array<{ fileName: string, source: string }> = []
    captureTestNativeEntryAssetOwners(ctx, [[file, 'component']])
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      },
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/foo/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({ component: true })
  })

  it('emits { component: true } for template-only Vue components', async () => {
    const ctx = createCtx(['pages/home/index'])
    const plugin = createVueTransformPlugin(ctx)
    const file = '/root/src/components/pure/index.vue'

    await callPluginHook(plugin.transform as any, {}, `<template><view>ok</view></template>`, file)

    const emitted: Array<{ fileName: string, source: string }> = []
    captureTestNativeEntryAssetOwners(ctx, [[file, 'component']])
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      },
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/pure/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({ component: true })
  })

  it('emits { component: true } when script contains Component(...)', async () => {
    const ctx = createCtx(['pages/home/index'])
    const plugin = createVueTransformPlugin(ctx)
    const file = '/root/src/components/mp/index.vue'

    await callPluginHook(plugin.transform as any, {}, `<template><view>ok</view></template><script>export default Component({})</script>`, file)

    const emitted: Array<{ fileName: string, source: string }> = []
    captureTestNativeEntryAssetOwners(ctx, [[file, 'component']])
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      },
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/mp/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({ component: true })
  })

  it('merges <json> blocks with { component: true } for components', async () => {
    const ctx = createCtx(['pages/home/index'])
    const plugin = createVueTransformPlugin(ctx)
    const file = '/root/src/components/bar/index.vue'

    await callPluginHook(plugin.transform as any, {}, `
<template><view>ok</view></template>
<script setup>const a = 1</script>
<json>
{
  "usingComponents": {
    "x": "/x"
  }
}
</json>
      `.trim(), file)

    const emitted: Array<{ fileName: string, source: string }> = []
    captureTestNativeEntryAssetOwners(ctx, [[file, 'component']])
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      },
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/bar/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({
      component: true,
      usingComponents: {
        x: '/x',
      },
    })
  })

  it('emits empty page json without component flags for declared pages', async () => {
    const ctx = createCtx(['pages/home/index'])
    const plugin = createVueTransformPlugin(ctx)
    const file = '/root/src/pages/home/index.vue'

    await callPluginHook(plugin.transform as any, {}, `<template><view>page</view></template><script>export default Component({})</script>`, file)

    const emitted: Array<{ fileName: string, source: string }> = []
    captureTestNativeEntryAssetOwners(ctx, [[file, 'page']])
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      },
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'pages/home/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({})
  })
})
