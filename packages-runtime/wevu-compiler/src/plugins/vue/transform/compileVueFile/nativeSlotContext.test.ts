import type { TemplateChildNode } from '@vue/compiler-core'
import type { TemplateCompileOptions } from '../../compiler/template'
import { runInNewContext } from 'node:vm'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import {
  WEVU_NATIVE_DECLARATION_ADDRESS_PROP,
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
  WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR,
  WEVU_NATIVE_SLOT_PARENT_EVENT,
  WEVU_NATIVE_SLOT_PARENT_METHOD,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_PROPS_ATTR,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as runtime from '../../../../../../wevu/src/internal-runtime'
import * as templateRuntime from '../../../../../../wevu/src/internal-template'
import * as reactivity from '../../../../../../wevu/src/reactivity'
import {
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
  WE_VU_COMPILER_TEMPLATE_MODULE_ID,
} from '../../../../constants'
import { generate, parseJsLike } from '../../../../utils/babel'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from '../../compiler/template'
import { compileVueFile } from './index'

const filename = 'src/components/native-slot.vue'
const platform = getMiniProgramTemplatePlatform('weapp')
const listener = `bind:${WEVU_NATIVE_SLOT_PARENT_EVENT}`

afterEach(() => vi.unstubAllGlobals())

function evaluateOptions(script: string): Record<string, any> {
  vi.stubGlobal('Component', vi.fn())
  const ast = parseJsLike(script)
  const globals: Record<string, unknown> = {}
  const modules: Record<string, object> = {
    [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime,
    [WE_VU_COMPILER_REACTIVITY_MODULE_ID]: reactivity,
    [WE_VU_COMPILER_TEMPLATE_MODULE_ID]: templateRuntime,
  }
  ast.program.body = ast.program.body.flatMap<t.Statement>((statement) => {
    if (t.isExportDefaultDeclaration(statement) && t.isExpression(statement.declaration)) {
      return [t.expressionStatement(t.assignmentExpression(
        '=',
        t.memberExpression(t.identifier('globalThis'), t.identifier('exportedOptions')),
        statement.declaration,
      ))]
    }
    if (!t.isImportDeclaration(statement)) {
      return [statement]
    }
    const module = modules[statement.source.value]
    if (!module) {
      throw new Error(`Unexpected runtime module: ${statement.source.value}`)
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        throw new Error('Expected a named runtime import')
      }
      const name = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
      globals[specifier.local.name] = Reflect.get(module, name)
    }
    return []
  })
  runInNewContext(generate(ast).code, globals)
  return globals.exportedOptions as Record<string, any>
}

interface TemplateElement {
  tag: string
  attrs: Record<string, string>
  children: Array<TemplateElement | string>
}

function readElements(template: string): TemplateElement[] {
  const visit = (node: TemplateChildNode): TemplateElement | string | undefined => {
    if (node.type === NodeTypes.TEXT) {
      return node.content.trim() || undefined
    }
    if (node.type !== NodeTypes.ELEMENT) {
      return undefined
    }
    return {
      tag: node.tag,
      attrs: Object.fromEntries(node.props.map((prop) => {
        if (prop.type !== NodeTypes.ATTRIBUTE) {
          throw new Error('Expected a native template attribute')
        }
        return [prop.name, prop.value?.content ?? '']
      })),
      children: node.children.map(visit).filter(child => child !== undefined),
    }
  }
  return baseParse(template).children.map(visit).filter((node): node is TemplateElement => typeof node === 'object')
}

describe('native slot context compilation', () => {
  it.each([
    ['template only', ''],
    ['normal object', '<script>export default { setup() { return { label: "leaf" } } }</script>'],
    ['normal identifier', '<script>const options = { setup() { return { label: "leaf" } } }; export default options</script>'],
    ['aliased defineComponent', '<script>import { defineComponent as define } from "wevu"; export default define({ setup() { return { label: "leaf" } } })</script>'],
    ['script setup', '<script setup>const label = "leaf"</script>'],
    ['TypeScript setup', '<script setup lang="ts">const label: string = "leaf"</script>'],
    ['merged scripts', '<script>export default { options: { virtualHost: true } }</script><script setup>const label = "leaf"</script>'],
    ['normal script without export', '<script>const label = "leaf"</script>'],
  ])('marks a slotless leaf through the %s path', async (kind, script) => {
    const result = await compileVueFile(`${script}<template><text>Leaf</text></template>`, filename, {
      skipComponentTransform: kind === 'merged scripts',
      sourceMap: false,
      template: { platform, scopedSlotsRequireProps: true },
    })
    const options = evaluateOptions(result.script!)
    expect(options[WEVU_NATIVE_SLOT_CONTEXT_KEY]).toBe(true)
    expect(readElements(result.template!)).toEqual([{ tag: 'text', attrs: {}, children: ['Leaf'] }])
    if (kind !== 'template only' && kind !== 'normal script without export') {
      expect(options.setup({}, { expose() {} }).label).toBe('leaf')
    }
    if (kind === 'merged scripts') {
      expect(options.options.virtualHost).toBe(true)
    }
  })

  it('marks a script-only SFC without requiring template metadata', async () => {
    const result = await compileVueFile('<script setup>const label = "leaf"</script>', filename, {
      sourceMap: false,
      template: { platform, scopedSlotsRequireProps: true },
    })
    expect(evaluateOptions(result.script!)[WEVU_NATIVE_SLOT_CONTEXT_KEY]).toBe(true)
  })

  it.each([
    ['public default', { platform, scopedSlotsRequireProps: false }, false],
    ['augmented default', { platform, scopedSlotsCompiler: 'augmented' }, false],
    ['low-level auto default', { platform }, true],
    ['explicit opt-in', { platform, scopedSlotsRequireProps: true }, true],
    ['opt-in overrides augmented', { platform, scopedSlotsCompiler: 'augmented', scopedSlotsRequireProps: true }, true],
    ['disabled scoped compiler', { platform, scopedSlotsCompiler: 'off', scopedSlotsRequireProps: true }, true],
    ['disabled compiler without opt-in', { platform, scopedSlotsCompiler: 'off', scopedSlotsRequireProps: false }, false],
    ['alipay', { platform: getMiniProgramTemplatePlatform('alipay'), scopedSlotsRequireProps: true }, false],
    ['tt', { platform: getMiniProgramTemplatePlatform('tt'), scopedSlotsRequireProps: true }, false],
    ['swan', { platform: getMiniProgramTemplatePlatform('swan'), scopedSlotsRequireProps: true }, false],
    ['jd', { platform: getMiniProgramTemplatePlatform('jd'), scopedSlotsRequireProps: true }, false],
    ['xhs', { platform: getMiniProgramTemplatePlatform('xhs'), scopedSlotsRequireProps: true }, false],
    ['Web WXML adapter', { platform: { ...platform, nativeSlotContext: false }, scopedSlotsRequireProps: true }, false],
  ] satisfies Array<[string, TemplateCompileOptions, boolean]>)('respects %s for runtime options and native outlets', async (_name, template, enabled) => {
    const result = await compileVueFile('<template><slot name="body" /></template>', filename, {
      skipComponentTransform: true,
      sourceMap: false,
      template,
    })
    expect(evaluateOptions(result.script!)[WEVU_NATIVE_SLOT_CONTEXT_KEY]).toBe(enabled ? true : undefined)
    expect(readElements(result.template!)).toEqual([{
      tag: 'slot',
      attrs: { name: 'body', ...(enabled ? { [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD, [WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]: '' } : {}) },
      children: [],
    }])
  })

  it.each(['auto', 'off'] as const)('preserves fallback, slot names and slotted scope in %s mode', (scopedSlotsCompiler) => {
    const result = compileVueTemplateToWxml('<slot name="header"><text>Header fallback</text></slot><slot><text>Default fallback</text></slot>', filename, {
      platform,
      scopedSlotsCompiler,
      scopedSlotsRequireProps: true,
      slottedScopeId: 'data-v-native-s',
    })
    expect(readElements(result.code)).toEqual(['header', 'default'].flatMap(name => [
      {
        tag: 'block',
        attrs: { 'wx:if': `{{${WEVU_SLOT_NAMES_PROP}&&${WEVU_SLOT_NAMES_PROP}.${name}}}` },
        children: [{
          tag: 'slot',
          attrs: { 'data-v-native-s': '', ...(name === 'header' ? { name } : {}), [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD, [WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]: '' },
          children: [],
        }],
      },
      {
        tag: 'block',
        attrs: { 'wx:else': '' },
        children: [{ tag: 'text', attrs: {}, children: [name === 'header' ? 'Header fallback' : 'Default fallback'] }],
      },
    ]))
  })

  it('preserves native fallback content when scoped props are explicitly disabled', () => {
    const result = compileVueTemplateToWxml('<slot :item="item"><text>Fallback</text></slot>', filename, {
      platform,
      scopedSlotsCompiler: 'off',
      scopedSlotsRequireProps: true,
    })
    expect(readElements(result.code)).toEqual([{
      tag: 'slot',
      attrs: { [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD, [WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]: '' },
      children: [{ tag: 'text', attrs: {}, children: ['Fallback'] }],
    }])
    expect(result.componentGenerics).toBeUndefined()
  })

  it('keeps forwarded native outlets and projected children inline', () => {
    const result = compileVueTemplateToWxml('<Provider><Leaf /><slot /></Provider>', filename, {
      platform,
      scopedSlotsCompiler: 'augmented',
      scopedSlotsRequireProps: true,
      wevuComponentTags: ['Provider', 'Leaf'],
    })
    expect(readElements(result.code)).toMatchObject([{
      tag: 'provider',
      attrs: { 'vue-slots': '{{ {default:true} }}' },
      children: [
        { tag: 'leaf', children: [] },
        { tag: 'slot', attrs: { [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD }, children: [] },
      ],
    }])
    expect(result.scopedSlotComponents).toBeUndefined()
  })

  it('keeps extracted scoped declarations on their owner while retaining nested native outlets', () => {
    const result = compileVueTemplateToWxml('<Provider v-slot="{ item }"><slot name="body" /><text>{{ item }}</text></Provider>', filename, {
      platform,
      scopedSlotsRequireProps: true,
      wevuComponentTags: ['Provider'],
    })
    expect(readElements(result.code)[0]?.attrs[WEVU_SLOT_OWNER_ID_ATTR]).toBe(`{{${WEVU_SLOT_OWNER_ID_KEY} || ''}}`)
    const asset = result.scopedSlotComponents?.[0]
    if (!asset) {
      throw new Error('Expected a scoped declaration component')
    }
    expect(readElements(asset.template)[0]).toEqual({
      tag: 'slot',
      attrs: { name: 'body', [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD, [WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]: '' },
      children: [],
    })
  })

  it('leaves real scoped props on their existing owner-driven path', () => {
    const result = compileVueTemplateToWxml('<slot :item="item" />', filename, {
      platform,
      scopedSlotsRequireProps: true,
    })
    const [scoped, fallback] = readElements(result.code)
    expect(scoped?.attrs[WEVU_SLOT_OWNER_ID_ATTR]).toBe(`{{${WEVU_SLOT_OWNER_ID_PROP}}}`)
    expect(scoped?.attrs[WEVU_SLOT_PROPS_ATTR]).toBe('{{[\'item\',item]}}')
    expect(fallback?.children).toEqual([{ tag: 'slot', attrs: {}, children: [] }])
    expect(scoped?.attrs[listener]).toBeUndefined()
    expect(result.componentGenerics?.[scoped!.tag]).toBe(true)
  })

  it.each([
    ...[
      'export default { components: { Renamed: Original, ThirdParty: Native } }',
      'export default define({ components: { Renamed: Original, ThirdParty: Native } })',
      'const options = { components: { Renamed: Original, ThirdParty: Native } }; export default options',
      'const options = { components: { Renamed: Original, ThirdParty: Native } }; export default define(options)',
      'const options = define({ components: { Renamed: Original, ThirdParty: Native } }); export default options',
      'import { defineComponent as defineVue } from "vue"; const options = { components: { Renamed: Original, ThirdParty: Native } }; export default defineVue(options)',
      'export default Object.assign({ components: { Renamed: Original, ThirdParty: Native } }, { name: "Host" })',
      'export default Object.assign({ components: { Renamed: Native, ThirdParty: Original } }, { components: { Renamed: Original, ThirdParty: Native } })',
      'export default define(Object.assign({}, { components: { Renamed: Original, ThirdParty: Native } }))',
    ].map(declaration => ({ declaration, lang: 'js' })),
    ...[
      'export default ({ components: { Renamed: Original, ThirdParty: Native } } as const)',
      'const options = { components: { Renamed: Original, ThirdParty: Native } }; export default (options satisfies object)',
      'const options = { components: { Renamed: Original, ThirdParty: Native } }; export default define(options as object)',
      'export default (define({ components: { Renamed: Original, ThirdParty: Native } }) satisfies object)!',
    ].map(declaration => ({ declaration, lang: 'ts' })),
  ])('addresses Options API registration aliases without marking third-party native declarations: $declaration', async ({ declaration, lang }) => {
    const result = await compileVueFile(`
<script lang="${lang}">
import { defineComponent as define } from 'wevu'
import Original from './provider.vue'
import Native from './native'
${declaration}
</script>
<template><Renamed><ThirdParty /><Renamed /></Renamed></template>`, filename, {
      sourceMap: false,
      template: { platform, scopedSlotsRequireProps: true },
      autoUsingComponents: {
        enabled: true,
        resolveUsingComponentPath: async source => source === './provider.vue' ? '/components/provider' : '/components/native',
      },
    })
    const [host] = readElements(result.template!)
    const children = host.children.filter((child): child is TemplateElement => typeof child === 'object')
    const evaluateAddress = (element: TemplateElement) => runInNewContext(element.attrs[WEVU_NATIVE_DECLARATION_ADDRESS_PROP].slice(2, -2)) as [string, string]
    expect(JSON.parse(result.config!).usingComponents).toEqual({
      'renamed': '/components/provider',
      'third-party': '/components/native',
    })
    const parent = evaluateAddress(host)
    expect(parent[1]).toBe('')
    expect(evaluateAddress(children[1])[1]).toBe(parent[0])
    expect(evaluateAddress(children[1])[0]).not.toBe(parent[0])
    expect(children[0].attrs[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]).toBeUndefined()
  })

  it('keeps native declaration identity separate from a shadowed prop alias', async () => {
    const result = await compileVueFile(`
<script setup lang="ts">
import Provider from './provider.vue'
import Leaf from './leaf.vue'
const { fallback: row } = defineProps<{ fallback: { id: string } }>()
const rows = [{ id: 'a', show: false }, { id: 'b', show: false }]
</script>
<template>
  <Provider v-for="row in rows" :key="row.id"><Leaf v-if="row.show" /></Provider>
  <text :title="row.id.toUpperCase()" />
</template>`, filename, {
      sourceMap: false,
      template: { platform, scopedSlotsRequireProps: true },
      autoUsingComponents: {
        enabled: true,
        resolveUsingComponentPath: async source => `/components/${source === './provider.vue' ? 'provider' : 'leaf'}`,
      },
    })
    const options = evaluateOptions(result.script!)
    const rows = [{ id: 'a', show: false }, { id: 'b', show: false }]
    const state = { rows, __wevuProps: { fallback: { id: 'shared' } } }
    const [provider, label] = readElements(result.template!)
    const findLeaf = (element: TemplateElement): TemplateElement | undefined => {
      if (element.tag === 'leaf') {
        return element
      }
      for (const child of element.children) {
        const found = typeof child === 'object' ? findLeaf(child) : undefined
        if (found) {
          return found
        }
      }
    }
    const child = findLeaf(provider)!
    const indexName = provider.attrs['wx:for-index'] ?? 'index'
    const evaluateBindings = () => Object.fromEntries(Object.entries(options.computed).map(([name, computed]) => [
      name,
      (computed as (this: typeof state) => unknown).call(state),
    ]))
    const address = (element: TemplateElement, index: number, bindings: Record<string, unknown>) =>
      runInNewContext(element.attrs[WEVU_NATIVE_DECLARATION_ADDRESS_PROP].slice(2, -2), { ...bindings, [indexName]: index }) as [string, string]
    const initial = evaluateBindings()
    const first = address(provider, 0, initial)
    const second = address(provider, 1, initial)
    expect(first[0]).not.toBe(second[0])
    expect([first[1], second[1]]).toEqual(['', ''])
    expect(runInNewContext(label.attrs.title.slice(2, -2), initial)).toBe('SHARED')
    rows[0].show = true
    const attached = evaluateBindings()
    expect(address(child, 0, attached)[1]).toBe(first[0])
    rows.reverse()
    const reordered = evaluateBindings()
    expect(address(provider, 0, reordered)).toEqual(second)
    expect(address(provider, 1, reordered)).toEqual(first)
    expect(address(child, 1, reordered)[1]).toBe(first[0])
  })
})
