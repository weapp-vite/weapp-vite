import type { TemplateChildNode } from '@vue/compiler-core'
import type { TemplateCompileOptions } from '../../compiler/template'
import { runInNewContext } from 'node:vm'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import {
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
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
import * as reactivity from '../../../../../../wevu/src/reactivity'
import {
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
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
      attrs: { name: 'body', ...(enabled ? { [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD } : {}) },
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
          attrs: { 'data-v-native-s': '', ...(name === 'header' ? { name } : {}), [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD },
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
      attrs: { [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD },
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
      attrs: { name: 'body', [listener]: WEVU_NATIVE_SLOT_PARENT_METHOD },
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
})
