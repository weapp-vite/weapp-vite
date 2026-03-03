import { describe, expect, it } from 'vitest'
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
})
