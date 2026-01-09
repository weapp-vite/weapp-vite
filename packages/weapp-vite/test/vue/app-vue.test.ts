import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(root: string, weappViteConfig: Record<string, any> = {}) {
  const absoluteSrcRoot = path.join(root, 'src')
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
      absoluteSrcRoot,
      weappViteConfig,
      isDev: true,
      relativeOutputPath(absoluteBase: string) {
        if (!absoluteBase.startsWith(`${absoluteSrcRoot}/`)) {
          return undefined
        }
        return absoluteBase.slice(absoluteSrcRoot.length + 1).replace(/\\/g, '/')
      },
      relativeCwd(p: string) {
        return path.relative(root, p).replace(/\\/g, '/')
      },
    },
    scanService: {
      appEntry: { json: { pages: ['pages/index/index'] } },
      loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
      loadSubPackages: () => [],
    },
  } as any
}

describe('app.vue transform', () => {
  it('registers wevu app via createApp() so app hooks run', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-app-vue-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root))
      const file = path.join(srcRoot, 'app.vue')

      const transformed = await plugin.transform!(
        `
<template><view>app</view></template>
<script setup lang="ts">
import { onShow } from 'wevu'
onShow(() => {})
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toContain('createApp')
      expect(transformed?.code).toContain('onShow')
      expect(transformed?.code).not.toContain('export default')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('injects wevu defaults into app entry when configured', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-app-vue-defaults-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          defaults: {
            component: {
              options: {
                addGlobalClass: true,
              },
            },
            app: {
              setData: {
                includeComputed: false,
              },
            },
          },
        },
      }))
      const file = path.join(srcRoot, 'app.vue')

      const transformed = await plugin.transform!(
        `
<template><view>app</view></template>
<script setup lang="ts">
import { onShow } from 'wevu'
onShow(() => {})
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toContain('setWevuDefaults')
      expect(transformed?.code).toContain('addGlobalClass')
      expect(transformed?.code).toContain('includeComputed')
    }
    finally {
      await fs.remove(root)
    }
  })
})
