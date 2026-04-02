import { describe, expect, it, vi } from 'vitest'
import {
  collectVueTemplateTags,
  isAutoImportCandidateTag,
  RESERVED_VUE_COMPONENT_TAGS,
} from './vueTemplateTags'

describe('vueTemplateTags', () => {
  it('detects candidate tags for auto import', () => {
    expect(isAutoImportCandidateTag('t-button')).toBe(true)
    expect(isAutoImportCandidateTag('TButton')).toBe(true)
    expect(isAutoImportCandidateTag('view')).toBe(false)
  })

  it('collects tags from template and skips reserved/builtin entries', () => {
    const tags = collectVueTemplateTags(`
<template>
  <view>
    <TButton />
    <t-card />
    <template v-if="ok"><FooBar /></template>
    <keep-alive><AComp /></keep-alive>
  </view>
</template>
    `.trim(), {
      filename: '/project/src/pages/index/index.vue',
      shouldCollect: () => true,
    })

    expect(tags.has('TButton')).toBe(true)
    expect(tags.has('t-card')).toBe(true)
    expect(tags.has('FooBar')).toBe(true)
    expect(tags.has('AComp')).toBe(true)
    expect(tags.has('view')).toBe(false)
    for (const reserved of RESERVED_VUE_COMPONENT_TAGS) {
      expect(tags.has(reserved)).toBe(false)
    }
  })

  it('respects shouldCollect and walks branches/alternate trees', () => {
    const tags = collectVueTemplateTags(`
<template>
  <FooBar v-if="ok" />
  <component :is="dynamic" />
  <TButton v-else-if="middle" />
  <FinalCard v-else />
  <slot />
</template>
    `.trim(), {
      shouldCollect: tag => tag !== 'TButton',
    })

    expect(tags.has('FooBar')).toBe(true)
    expect(tags.has('FinalCard')).toBe(true)
    expect(tags.has('TButton')).toBe(false)
    expect(tags.has('component')).toBe(false)
    expect(tags.has('slot')).toBe(false)
  })

  it('warns when parsing throws and returns collected tags accumulated so far', async () => {
    vi.resetModules()
    vi.doMock('@vue/compiler-core', async () => {
      const actual = await vi.importActual<typeof import('@vue/compiler-core')>('@vue/compiler-core')
      return {
        ...actual,
        baseParse: () => {
          throw new Error('mock parse failure')
        },
      }
    })

    try {
      const warn = vi.fn()
      const { collectVueTemplateTags: collectTags } = await import('./vueTemplateTags')
      const tags = collectTags('<Broken', {
        filename: '/tmp/Broken.vue',
        warnLabel: 'auto-import',
        warn,
        shouldCollect: () => true,
      })

      expect([...tags]).toEqual([])
      expect(warn).toHaveBeenCalledWith('[Vue 模板] 解析失败：auto-import（/tmp/Broken.vue）：mock parse failure')
    }
    finally {
      vi.doUnmock('@vue/compiler-core')
      vi.resetModules()
    }
  })
})
