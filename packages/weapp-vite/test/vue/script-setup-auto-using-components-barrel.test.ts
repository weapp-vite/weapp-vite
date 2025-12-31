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

describe('<script setup> auto usingComponents (barrel exports)', () => {
  it('resolves named export from barrel to real component path', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-barrel-'))
    const srcRoot = path.join(root, 'src')

    try {
      await fs.outputFile(
        path.join(srcRoot, 'components/index.ts'),
        `export { default as VueCard } from './vue-card/index.vue'\n`,
      )
      await fs.outputFile(
        path.join(srcRoot, 'components/vue-card/index.vue'),
        `<template><view>card</view></template><script setup>const a = 1</script>`,
      )

      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/index']))
      const resolver = async (source: string, importer?: string) => {
        if (!importer) {
          return { id: source } as any
        }
        if (source.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), source) } as any
        }
        return { id: source } as any
      }

      const pageFile = path.join(srcRoot, 'pages/demo/index.vue')
      const sfc = `
<template>
  <VueCard />
</template>
<script setup lang="ts">
import { VueCard } from '../../components'
console.log(VueCard)
</script>
      `.trim()

      const transformed = await plugin.transform!.call(
        { resolve: resolver } as any,
        sfc,
        pageFile,
      )

      expect(transformed?.code).toBeDefined()
      const js = String(transformed!.code)
      expect(js).not.toContain('../../components')
      expect(js).toContain('__weappViteUsingComponent')
      expect(js).toContain('/components/vue-card/index')

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          resolve: resolver,
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        } as any,
        {},
        {},
      )

      const jsonAsset = emitted.find(item => item.fileName === 'pages/demo/index.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        component: true,
        usingComponents: {
          VueCard: '/components/vue-card/index',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })
})
