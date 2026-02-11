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

  it('auto injects page share config from wevu share hooks', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-294',
})

onShareAppMessage(() => ({ title: 'share' }))
onShareTimeline(() => ({ title: 'timeline' }))
</script>
      `.trim(),
      '/project/src/pages/issue-294/index.vue',
      {
        isPage: true,
      },
    )

    expect(result.config).toBeTruthy()
    const parsed = JSON.parse(result.config!)
    expect(parsed.navigationBarTitleText).toBe('issue-294')
    expect(parsed.enableShareAppMessage).toBe(true)
    expect(parsed.enableShareTimeline).toBe(true)
  })
})
