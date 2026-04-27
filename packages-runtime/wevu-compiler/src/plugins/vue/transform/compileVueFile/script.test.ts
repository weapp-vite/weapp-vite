import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from './componentSources'
import { compileScriptPhase } from './script'

describe('compileScriptPhase', () => {
  it('returns fallback script when both script and script setup are absent', async () => {
    const descriptor = parse(`<template><view /></template>`, { filename: '/project/src/pages/index/index.vue' }).descriptor

    const result = await compileScriptPhase(
      descriptor as any,
      descriptor as any,
      '/project/src/pages/index/index.vue',
      undefined,
      undefined,
      undefined,
      false,
    )

    expect(result.script).toContain('createWevuComponent')
    expect(result.autoUsingComponentsMap).toEqual({})
    expect(result.autoComponentMeta).toEqual({})
  })

  it('collects auto using components from script setup imports and compiles script', async () => {
    const sfc = parse(`
<template>
  <view><TButton /></view>
</template>
<script setup lang="ts">
import TButton from '@/components/TButton'
const local = 'ok'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const resolveUsingComponentPath = vi.fn(async (importSource: string) => {
      if (importSource === '@/components/TButton') {
        return 'tdesign/button/button'
      }
      return undefined
    })

    const componentSourceInfo = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: { isPage: true },
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
      autoImportTags: undefined,
    })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/pages/index/index.vue',
      { isPage: true },
      {
        resolveUsingComponentPath,
      },
      undefined,
      false,
      componentSourceInfo,
    )

    expect(result.script).toContain('createWevuComponent')
    expect(result.autoUsingComponentsMap).toEqual({
      TButton: 'tdesign/button/button',
    })
    expect(result.autoComponentMeta).toEqual({
      TButton: 'tdesign/button/button',
    })
    expect(resolveUsingComponentPath).toHaveBeenCalled()
  })

  it('marks kebab-case template usage of imported vue components as wevu components', async () => {
    const sfc = parse(`
<template>
  <my-card>
    <template #header>
      <view>Header</view>
    </template>
  </my-card>
</template>
<script setup lang="ts">
import MyCard from './my-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const result = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async () => ({
          from: '/components/my-card',
          resolvedId: '/project/src/components/my-card.vue',
        }),
      },
      autoImportTags: undefined,
    })

    expect(result.wevuComponentTags.has('MyCard')).toBe(true)
    expect(result.wevuComponentTags.has('my-card')).toBe(true)
  })

  it('marks direct .vue imports without auto using component resolver', async () => {
    const sfc = parse(`
<template>
  <my-card />
</template>
<script setup lang="ts">
import MyCard from './my-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const result = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: undefined,
      autoImportTags: undefined,
    })

    expect(result.autoUsingComponentsMap).toEqual({})
    expect(result.wevuComponentTags.has('MyCard')).toBe(true)
    expect(result.wevuComponentTags.has('my-card')).toBe(true)
  })
})
