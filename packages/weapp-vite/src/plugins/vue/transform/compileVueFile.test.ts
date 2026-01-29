import { describe, expect, it } from 'vitest'
import { compileVueFile } from 'wevu/compiler'

describe('compileVueFile - auto import tags', () => {
  it('collects PascalCase tags for autoImportTags', async () => {
    const result = await compileVueFile(
      `
<template>
  <TButton />
</template>
<script setup lang="ts">
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
      {
        autoImportTags: {
          enabled: true,
          resolveUsingComponent: async (tag) => {
            if (tag === 'TButton') {
              return { name: tag, from: 'tdesign-miniprogram/button/button' }
            }
            return undefined
          },
        },
      },
    )

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      usingComponents: {
        TButton: 'tdesign-miniprogram/button/button',
      },
    })
  })

  it('injects inline expression map for template handlers', async () => {
    const result = await compileVueFile(
      `
<template>
  <view @tap="handle('ok')">Tap</view>
</template>
<script setup lang="ts">
const handle = (value: string) => value
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
    )

    expect(result.script).toContain('__weapp_vite_inline_map')
    expect(result.script).toContain('__wv_inline_0')
    expect(result.script).toContain('ctx.handle')
  })
})
