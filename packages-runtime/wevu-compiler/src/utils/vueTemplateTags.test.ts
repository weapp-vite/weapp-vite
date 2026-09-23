import type { CollectVueTemplateTagsOptions } from './vueTemplateTags'
import { describe, expect, it, vi } from 'vitest'
import {
  collectVueTemplateTags,
  isAutoImportCandidateTag,
  RESERVED_VUE_COMPONENT_TAGS,
  VUE_COMPONENT_TAG_RE,
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

  it('preserves exact spelling and first occurrence order across tag filters', () => {
    const template = `
<view><text /><scroll-view />
  <TButton /><t-button /><TButton /><month /><Month /><month />
  <Foo$Bar /><ns:panel /><Widget.Part />
  <template><slot /><component /><transition /><keep-alive /><teleport /><suspense /></template>
</view>`
    expect([...collectVueTemplateTags(template, { shouldCollect: () => true })]).toEqual([
      'TButton',
      't-button',
      'month',
      'Month',
      'Foo$Bar',
      'ns:panel',
      'Widget.Part',
    ])
    expect([...collectVueTemplateTags(template, { shouldCollect: isAutoImportCandidateTag })]).toEqual([
      'TButton',
      't-button',
      'Month',
      'Foo$Bar',
    ])
    expect([...collectVueTemplateTags(template, {
      shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag) || isAutoImportCandidateTag(tag),
    })]).toEqual(['TButton', 't-button', 'month', 'Month', 'Foo$Bar'])
  })

  it('keeps custom predicate decisions before deduplication and builtin filtering', () => {
    let sawNativeTag = false
    let sawFirstCard = false
    const tags = collectVueTemplateTags('<view><Card /><Card /></view>', {
      shouldCollect: (tag) => {
        if (tag === 'view') {
          sawNativeTag = true
        }
        if (tag !== 'Card') {
          return true
        }
        const collect = sawNativeTag && sawFirstCard
        sawFirstCard = true
        return collect
      },
    })
    expect([...tags]).toEqual(['Card'])
  })

  it('preserves the options receiver of a method-style component predicate', () => {
    const options: CollectVueTemplateTagsOptions = {
      filename: 'Card',
      shouldCollect(tag) {
        return tag === this.filename
      },
    }
    expect([...collectVueTemplateTags('<Other /><Card />', options)]).toEqual(['Card'])
  })

  it('preserves partial tags, initial warning context, and the warning callback receiver', () => {
    const warnings: string[] = []
    const options: CollectVueTemplateTagsOptions = {
      filename: 'src/Broken.vue',
      warnLabel: 'auto-import',
      warn(this: unknown, message) {
        if (this !== undefined) {
          throw new Error('warning callback receiver changed')
        }
        warnings.push(message)
      },
      shouldCollect(tag) {
        if (tag === 'BrokenCard') {
          this.filename = 'changed.vue'
          this.warnLabel = 'changed-label'
          this.warn = () => {
            throw new Error('warning callback replaced during analysis')
          }
          throw new Error('component policy unavailable')
        }
        return true
      },
    }
    const tags = collectVueTemplateTags('<FirstCard /><BrokenCard /><LastCard />', options)
    expect([...tags]).toEqual(['FirstCard'])
    expect(warnings).toEqual([
      expect.stringContaining('src/Broken.vue'),
    ])
    expect(warnings[0]).toContain('auto-import')
    expect(warnings[0]).toContain('component policy unavailable')
  })

  it('leaves recoverable syntax diagnostics to the owning template compiler', () => {
    const warn = vi.fn()
    const tags = collectVueTemplateTags('<view><CustomCard></view>', {
      shouldCollect: () => true,
      warn,
    })
    expect([...tags]).toEqual(['CustomCard'])
    expect(warn).not.toHaveBeenCalled()
  })
})
