import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(pages: string[] = []) {
  const cwd = '/root'
  const absoluteSrcRoot = '/root/src'
  const appEntry = { json: { pages } }
  return {
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
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    await plugin.transform!(
      `<template><view>ok</view></template><script setup>const a = 1</script>`,
      '/root/src/components/foo/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
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
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    await plugin.transform!(
      `<template><view>ok</view></template>`,
      '/root/src/components/pure/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
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
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    await plugin.transform!(
      `<template><view>ok</view></template><script>export default Component({})</script>`,
      '/root/src/components/mp/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
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

  it('merges <config> blocks with { component: true } for components', async () => {
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    await plugin.transform!(
      `
<template><view>ok</view></template>
<script setup>const a = 1</script>
<config>
{
  "usingComponents": {
    "x": "/x"
  }
}
</config>
      `.trim(),
      '/root/src/components/bar/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
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

  it('emits { component: true } for declared pages too', async () => {
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    await plugin.transform!(
      `<template><view>page</view></template><script>export default Component({})</script>`,
      '/root/src/pages/home/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
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
    expect(JSON.parse(jsonAsset!.source)).toEqual({ component: true })
  })
})
