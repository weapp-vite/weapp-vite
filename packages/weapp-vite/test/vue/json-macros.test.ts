import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(root: string, pages: string[] = []) {
  const absoluteSrcRoot = path.join(root, 'src')
  const appEntry = { json: { pages } }
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
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

describe('<script setup> json macros', () => {
  it('merges defineComponentJson() into emitted json with highest priority', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))

      const file = path.join(srcRoot, 'components/foo/index.vue')
      const transformed = await plugin.transform!(
        `
<template><view>ok</view></template>
<script setup lang="ts">
defineComponentJson({
  styleIsolation: 'isolated',
  usingComponents: {
    a: '/from-macro'
  }
})
</script>
<json lang="jsonc">
{
  "styleIsolation": "apply-shared",
  "usingComponents": {
    "a": "/from-json",
    "b": "/b"
  }
}
</json>
        `.trim(),
        file,
      )

      expect(transformed?.code).not.toContain('defineComponentJson')

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
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        component: true,
        styleIsolation: 'isolated',
        usingComponents: {
          a: '/from-macro',
          b: '/b',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('merges defineAppJson() over existing bundle asset', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))
      const file = path.join(srcRoot, 'app.vue')

      await plugin.transform!(
        `
<template><view>app</view></template>
<script setup lang="ts">
defineAppJson({
  style: 'v3'
})
</script>
        `.trim(),
        file,
      )

      const bundle: Record<string, any> = {
        'app.json': {
          type: 'asset',
          source: JSON.stringify({ style: 'v2', pages: ['pages/home/index'] }),
        },
      }

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        },
        {},
        bundle,
      )

      const jsonAsset = emitted.find(item => item.fileName === 'app.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        style: 'v3',
        pages: ['pages/home/index'],
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('supports imports and expressions inside macro', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      await fs.outputFile(
        path.join(srcRoot, 'pages/demo/config.ts'),
        `export const prefix = '/from-import'\n`,
      )

      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/index']))
      const file = path.join(srcRoot, 'pages/demo/index.vue')
      const sfc = `
<template><view>demo</view></template>
<script setup lang="ts">
import { prefix } from './config'
const name = 'X'
definePageJson({
  usingComponents: {
    [name]: prefix + '/x'
  }
})
</script>
      `.trim()

      await plugin.transform!(sfc, file)

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

      const jsonAsset = emitted.find(item => item.fileName === 'pages/demo/index.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        component: true,
        usingComponents: {
          X: '/from-import/x',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })
})
