import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import { WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from '../../src/plugins/vue/transform/styleRequest'

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

describe('Vue SFC style pipeline', () => {
  it('injects a Vite CSS request for <style lang="scss"> and exposes style content via load()', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-style-pipeline-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root))
      const file = path.join(srcRoot, 'app.vue')

      const transformed = await plugin.transform!(
        `
<template><view>app</view></template>
<script setup lang="ts">
defineAppJson({ pages: ['pages/index/index'] })
</script>
<style lang="scss">
.a { color: red; }
</style>
        `.trim(),
        file,
      )

      const match = transformed?.code.match(/import\s+("([^"]+)");/)
      expect(match?.[1]).toBeTruthy()
      const styleRequestId = JSON.parse(match![1])
      expect(styleRequestId.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(true)
      expect(styleRequestId).toContain('?weapp-vite-vue&type=style&index=0&lang.scss')

      const loaded = await plugin.load!(
        styleRequestId,
      ) as any

      expect(loaded?.code).toContain('.a { color: red; }')
    }
    finally {
      await fs.remove(root)
    }
  })
})
