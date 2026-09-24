import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo, collectTemplateComponentNames } from './componentSources'
import { compileVueFile } from './index'

describe('template component analysis', () => {
  it('matches exact, camel and Pascal names without folding tag case or dropping lowercase components', () => {
    const names = collectTemplateComponentNames(`
<view><scroll-view /><text />
  <template v-if="ready"><TButton /><t-button /><TButton /></template>
  <month /><month /><year-panel />
  <slot /><component /><transition /><keep-alive /><teleport /><suspense />
</view>`, 'src/components/calendar.vue')

    expect([...names]).toEqual(['TButton', 't-button', 'tButton', 'month', 'Month', 'year-panel', 'yearPanel', 'YearPanel'])
  })

  it('keeps member and namespaced tags in the all-component name view', () => {
    const names = collectTemplateComponentNames('<UI.Card /><foo:bar /><UI.Card />', 'src/components/member.vue')

    expect([...names]).toEqual(['UI.Card', 'foo:bar', 'Foo:bar'])
  })

  it('keeps lowercase script registrations outside auto-import candidates', async () => {
    const descriptor = parse(`<script setup>
import Month from 'native/month'
import TButton from 'native/button'
import Unused from 'native/unused'
</script>
<template><view><month /><TButton /><t-button /><TButton /><auto-card /><auto-card /></view></template>`).descriptor
    const result = await collectComponentSourceInfo({
      descriptor,
      descriptorForCompile: descriptor,
      filename: 'src/pages/calendar.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async source => source,
      },
      autoImportTags: {
        resolveUsingComponent: async tag => ({ name: tag, from: `auto/${tag}` }),
      },
    })

    expect(result.autoUsingComponentsMap).toEqual({
      'month': 'native/month',
      'TButton': 'native/button',
      't-button': 'native/button',
    })
    expect(result.autoImportTagsMap).toEqual({
      'TButton': 'auto/TButton',
      't-button': 'auto/t-button',
      'auto-card': 'auto/auto-card',
    })
  })

  it('preserves usingComponents precedence, WXML tags and script bindings in a full compile', async () => {
    const warnings: string[] = []
    const result = await compileVueFile(`<script setup>
import Month from 'native/month'
import TButton from 'native/button'
const title = 'calendar'
console.log(TButton)
</script>
<template>
  <view><text>{{ title }}</text><scroll-view />
    <month /><TButton /><t-button /><TButton />
    <auto-card /><auto-card />
  </view>
</template>`, 'src/pages/calendar.vue', {
      isPage: true,
      sourceMap: false,
      autoUsingComponents: {
        enabled: true,
        resolveUsingComponentPath: async source => source,
        warn: message => warnings.push(message),
      },
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async (tag) => {
          if (tag === 'auto-card' || tag === 'TButton' || tag === 't-button') {
            return { name: tag, from: `auto/${tag}` }
          }
          return undefined
        },
      },
    })
    const config: unknown = JSON.parse(result.config!)
    expect(config).toHaveProperty('usingComponents', {
      'month': 'native/month',
      't-button': 'native/button',
      'auto-card': 'auto/auto-card',
    })
    expect(result.meta?.jsonConfigCache?.autoUsingComponentsMap).toEqual({
      'month': 'native/month',
      'TButton': 'native/button',
      't-button': 'native/button',
    })
    expect(result.template).toContain('<view>')
    expect(result.template).toContain('<text>{{title}}</text>')
    expect(result.template).toMatch(/<month\b/)
    expect(result.template?.match(/<t-button\b/g)).toHaveLength(3)
    expect(result.template?.match(/<auto-card\b/g)).toHaveLength(2)
    expect(result.script).not.toMatch(/import\s+Month\b/)
    expect(result.script).toMatch(/import\s+TButton\s+from\s+['"]native\/button['"]/)
    expect(result.script).toContain('console.log(TButton)')
    expect(warnings).toContainEqual(expect.stringContaining('usingComponents'))
    expect(warnings).toContainEqual(expect.stringContaining('native/button'))
  })

  it('rejects malformed templates through the full compiler instead of accepting recovered tags', async () => {
    await expect(compileVueFile('<template><view><CustomCard /></template>', 'src/pages/broken.vue', {
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async tag => ({ name: tag, from: `native/${tag}` }),
      },
    })).rejects.toThrow('src/pages/broken.vue')
  })
})
