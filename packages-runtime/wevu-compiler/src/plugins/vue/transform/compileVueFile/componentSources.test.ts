import { setImmediate } from 'node:timers/promises'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_DECLARATION_EVENT, WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import path from 'pathe'
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
  })

  it('uses the batched native import summary without changing component registration output', async () => {
    const descriptor = parse(`<script setup>
import TButton from 'native/button'
</script>
<template><TButton /></template>`).descriptor
    const result = await collectComponentSourceInfo({
      descriptor,
      descriptorForCompile: descriptor,
      filename: 'src/pages/native-summary.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async source => source,
      },
      autoImportTags: undefined,
      nativeScriptAnalysis: {
        scriptSetup: {
          imports: [{
            local: 'TButton',
            imported: 'default',
            source: 'native/button',
            kind: 'default',
            typeOnly: false,
          }],
          defineOptionsStatements: [],
        },
      },
    })

    expect(result.autoUsingComponentsMap).toEqual({ TButton: 'native/button' })
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

  it.each([true, false])('follows explicit component precedence for native participation: %s', async (contextInExplicitImport) => {
    const pure = '<template><text>pure</text></template>'
    const consumer = '<script setup>import { inject } from "wevu"; inject("token")</script><template><text>consumer</text></template>'
    const files: Record<string, string> = {
      '/project/Explicit.vue': contextInExplicitImport ? consumer : pure,
      '/project/Automatic.vue': contextInExplicitImport ? pure : consumer,
    }
    const result = await compileVueFile('<script setup>import Child from "./Explicit.vue"</script><template><Child /></template>', '/project/Parent.vue', {
      sourceMap: false,
      template: { nativeSlotContext: true, scopedSlotsRequireProps: true },
      sfcSrc: { readFile: async id => files[id]! },
      autoUsingComponents: {
        enabled: true,
        warn: () => {},
        resolveUsingComponentPath: async () => ({ from: '/components/explicit', resolvedId: '/project/Explicit.vue', sourceType: 'wevu-sfc' }),
      },
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async () => ({ name: 'child', from: '/components/automatic', resolvedId: '/project/Automatic.vue', sourceType: 'wevu-sfc' }),
      },
    })
    const config: unknown = JSON.parse(result.config!)
    expect(config).toHaveProperty('usingComponents.child', '/components/explicit')
    expect(result.script!.includes(WEVU_NATIVE_SLOT_CONTEXT_KEY)).toBe(contextInExplicitImport)
    expect(result.template!.includes(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)).toBe(contextInExplicitImport)
    expect(result.meta?.nativeSlotContextDeps).toContain('/project/Explicit.vue')
    expect(result.meta?.nativeSlotContextDeps).not.toContain('/project/Automatic.vue')
  })

  describe.each(['native', 'wevu-sfc'] as const)('atomic %s registration precedence', (explicitType) => {
    const consumer = '<script setup>import { inject } from "wevu"; inject("token")</script><template><text>consumer</text></template>'
    const native = 'Component({})'

    it.each(['explicit', 'automatic'])('keeps the explicit winner when %s resolves first', async (first) => {
      const root = path.resolve('src/registration-precedence')
      const explicitId = `${root}/Explicit.${explicitType === 'native' ? 'js' : 'vue'}`
      const automaticType = explicitType === 'native' ? 'wevu-sfc' : 'native'
      const automaticId = `${root}/Automatic.${automaticType === 'native' ? 'js' : 'vue'}`
      const files: Record<string, string> = {
        [explicitId]: explicitType === 'native' ? native : consumer,
        [automaticId]: automaticType === 'native' ? native : consumer,
      }
      const completed: string[] = []
      const result = await compileVueFile('<script setup>import Child from "./Explicit"</script><template><Child /><child /></template>', `${root}/Parent.vue`, {
        sourceMap: false,
        template: { nativeSlotContext: true, scopedSlotsRequireProps: true },
        componentMetaCache: new Map([
          [explicitId, Promise.resolve({ componentName: 'Explicit', isMiniProgramComponent: explicitType !== 'native' })],
          [automaticId, Promise.resolve({ componentName: 'Automatic', isMiniProgramComponent: automaticType !== 'native' })],
        ]),
        sfcSrc: { readFile: async id => files[id]! },
        autoUsingComponents: {
          enabled: true,
          warn: () => {},
          resolveUsingComponentPath: async () => {
            if (first !== 'explicit') {
              await setImmediate()
            }
            completed.push('explicit')
            return { from: '/components/explicit', resolvedId: explicitId, sourceType: explicitType }
          },
        },
        autoImportTags: {
          enabled: true,
          resolveUsingComponent: async () => {
            if (first !== 'automatic') {
              await setImmediate()
            }
            completed.push('automatic')
            return { name: 'child', from: '/components/automatic', resolvedId: automaticId, sourceType: automaticType }
          },
        },
      })

      expect(completed[0]).toBe(first)
      const config: unknown = JSON.parse(result.config!)
      expect(config).toHaveProperty('usingComponents', { child: '/components/explicit' })
      const declarations = result.template!.match(/<child\b[^>]*>/g)
      expect(declarations).toHaveLength(2)
      for (const declaration of declarations!) {
        expect(declaration.includes(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)).toBe(explicitType === 'wevu-sfc')
        expect(declaration.includes(`bind:${WEVU_NATIVE_DECLARATION_EVENT}`)).toBe(explicitType === 'wevu-sfc')
      }
      expect(result.meta?.nativeSlotContextDeps).toContain(explicitId)
      expect(result.meta?.nativeSlotContextDeps).not.toContain(automaticId)
    })

    it.each(['setup', 'options'])('keeps setup bindings ahead of Options components when %s resolves first', async (first) => {
      const root = path.resolve('src/registration-precedence')
      const setupId = `${root}/SetupChild.${explicitType === 'native' ? 'js' : 'vue'}`
      const optionsType = explicitType === 'native' ? 'wevu-sfc' : 'native'
      const optionsId = `${root}/OptionsChild.${optionsType === 'native' ? 'js' : 'vue'}`
      const files: Record<string, string> = {
        [setupId]: explicitType === 'native' ? native : consumer,
        [optionsId]: optionsType === 'native' ? native : consumer,
      }
      const completed: string[] = []
      const result = await compileVueFile(`<script>
import OptionsChild from './OptionsChild'
export default { components: { Child: OptionsChild } }
</script>
<script setup>import Child from './SetupChild'</script>
<template><Child /><child /></template>`, `${root}/Parent.vue`, {
        sourceMap: false,
        template: { nativeSlotContext: true, scopedSlotsRequireProps: true },
        componentMetaCache: new Map([
          [setupId, Promise.resolve({ componentName: 'SetupChild', isMiniProgramComponent: explicitType !== 'native' })],
          [optionsId, Promise.resolve({ componentName: 'OptionsChild', isMiniProgramComponent: optionsType !== 'native' })],
        ]),
        sfcSrc: { readFile: async id => files[id]! },
        autoUsingComponents: {
          enabled: true,
          warn: () => {},
          resolveUsingComponentPath: async (source) => {
            const kind = source === './SetupChild' ? 'setup' : 'options'
            if (first !== kind) {
              await setImmediate()
            }
            completed.push(kind)
            return kind === 'setup'
              ? { from: '/components/setup', resolvedId: setupId, sourceType: explicitType }
              : { from: '/components/options', resolvedId: optionsId, sourceType: optionsType }
          },
        },
      })

      expect(completed.slice(0, 2)).toEqual([first, first === 'setup' ? 'options' : 'setup'])
      const config: unknown = JSON.parse(result.config!)
      expect(config).toHaveProperty('usingComponents', { child: '/components/setup' })
      const declarations = result.template!.match(/<child\b[^>]*>/g)
      expect(declarations).toHaveLength(2)
      for (const declaration of declarations!) {
        expect(declaration.includes(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)).toBe(explicitType === 'wevu-sfc')
        expect(declaration.includes(`bind:${WEVU_NATIVE_DECLARATION_EVENT}`)).toBe(explicitType === 'wevu-sfc')
      }
      expect(result.meta?.nativeSlotContextDeps).toContain(setupId)
    })
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
