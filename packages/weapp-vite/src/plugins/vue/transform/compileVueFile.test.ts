import { describe, expect, it } from 'vitest'
import { compileVueFile } from './compileVueFile'

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
})
