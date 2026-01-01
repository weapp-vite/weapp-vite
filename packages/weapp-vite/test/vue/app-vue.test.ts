import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(root: string) {
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
import { onAppShow } from 'wevu'
onAppShow(() => {})
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toContain('createApp')
      expect(transformed?.code).toContain('onAppShow')
      expect(transformed?.code).not.toContain('export default')
    }
    finally {
      await fs.remove(root)
    }
  })
})
