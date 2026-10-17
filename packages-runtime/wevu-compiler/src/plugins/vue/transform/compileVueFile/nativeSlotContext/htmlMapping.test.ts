import type { TemplateCompileOptions } from '../../../compiler/template'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { getMiniProgramTemplatePlatform } from '../../../compiler/template'
import { compileVueFile } from '../index'
import { createAnalysisFixture } from './testSupport'

const platform = getMiniProgramTemplatePlatform('weapp')

describe('native slot context HTML tag mapping', () => {
  it.each([
    ['default HTML mapping', 'div', undefined, 'view', false],
    ['enabled HTML mapping', 'p', true, 'view', false],
    ['disabled HTML mapping', 'div', false, 'div', true],
    ['custom native mapping', 'div', { div: 'text' }, 'text', false],
    ['custom component mapping', 'div', { div: 'custom-shell' }, 'custom-shell', true],
    ['capitalized component spelling', 'Div', true, 'div', true],
  ] satisfies Array<[string, string, TemplateCompileOptions['htmlTagToWxml'], string, boolean]>)('uses emitted tag semantics for %s', async (_name, tag, htmlTagToWxml, emittedTag, required) => {
    const result = await compileVueFile(`<template><${tag}>Leaf</${tag}></template>`, 'src/components/leaf.vue', {
      sourceMap: false,
      template: { platform, nativeSlotContext: true, scopedSlotsRequireProps: true, htmlTagToWxml },
    })
    expect(result.script?.includes(WEVU_NATIVE_SLOT_CONTEXT_KEY)).toBe(required)
    const element = baseParse(result.template!).children[0]
    expect(element?.type).toBe(NodeTypes.ELEMENT)
    if (element?.type === NodeTypes.ELEMENT) {
      expect(element.tag).toBe(emittedTag)
    }
  })

  it.each([
    ['default mapping', 'Div', 'div', true],
    ['custom mapping', 'Child', 'child', { child: 'view' }],
  ] satisfies Array<[string, string, string, TemplateCompileOptions['htmlTagToWxml']]>)('ignores non-instantiated component candidates under %s', async (_name, localName, tag, htmlTagToWxml) => {
    const fixture = createAnalysisFixture({
      '/project/Consumer.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    })
    const source = `<script setup>import ${localName} from "./Consumer.vue"</script><template><${tag} /></template>`
    const result = await compileVueFile(source, '/project/Root.vue', {
      ...fixture.options,
      template: { platform, nativeSlotContext: true, scopedSlotsRequireProps: true, htmlTagToWxml },
    })
    const element = baseParse(result.template!).children[0]
    expect(element?.type === NodeTypes.ELEMENT && element.tag).toBe('view')
    expect(result.script).not.toContain(WEVU_NATIVE_SLOT_CONTEXT_KEY)
    expect(result.template).not.toContain(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)
  })

  it('reclassifies mapped descendants with the current mapping instead of cached decisions', async () => {
    const fixture = createAnalysisFixture({ '/project/Child.vue': '<template><div>Leaf</div></template>' })
    const source = '<script setup>import Child from "./Child.vue"</script><template><Child /></template>'
    for (const [htmlTagToWxml, required] of [[true, false], [false, true], [true, false]] as const) {
      fixture.options.template = { htmlTagToWxml }
      const result = await fixture.analyze(source)
      expect(result.required).toBe(required)
      expect(result.tags.has('Child')).toBe(required)
    }
  })

  it('retains context-bearing descendants despite their mapped native wrapper', async () => {
    const fixture = createAnalysisFixture({
      '/project/Child.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><div>{{ value }}</div></template>',
    })
    const result = await fixture.analyze('<script setup>import Child from "./Child.vue"</script><template><Child /></template>')
    expect(result.required).toBe(true)
    expect(result.tags.has('Child')).toBe(true)
  })
})
