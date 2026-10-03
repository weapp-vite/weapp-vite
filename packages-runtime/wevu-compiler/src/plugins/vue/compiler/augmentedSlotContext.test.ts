import type { TemplateChildNode } from '@vue/compiler-core'
import type { Ref } from '../../../../../wevu/src/reactivity'
import type { TemplateCompileOptions } from './template'
import { runInNewContext } from 'node:vm'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import {
  WEVU_SCOPED_SLOT_CREATOR_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_ATTR,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as runtime from '../../../../../wevu/src/internal-runtime'
import * as reactivity from '../../../../../wevu/src/reactivity'
import { nextTick } from '../../../../../wevu/src/scheduler'
import { WE_VU_COMPILER_RUNTIME_MODULE_ID } from '../../../constants'
import { generate, parseJsLike } from '../../../utils/babel'
import { compileVueTemplateToWxml } from './template'

interface CounterContext {
  label: string
  count: Ref<number>
  increment: () => void
}

const registered = vi.fn<(definition: Record<string, any>) => void>()
const mounted: Array<{ definition: Record<string, any>, target: Record<string, any> }> = []

beforeEach(() => {
  registered.mockClear()
  vi.stubGlobal('Component', registered)
  vi.stubGlobal(WEVU_SCOPED_SLOT_CREATOR_KEY, undefined)
  runtime.installScopedSlots()
})

afterEach(() => {
  for (const { definition, target } of mounted.splice(0).reverse()) {
    definition.lifetimes.detached.call(target)
  }
  vi.unstubAllGlobals()
})

function latestDefinition() {
  const definition = registered.mock.calls.at(-1)?.[0]
  if (!definition) {
    throw new Error('Expected a registered component')
  }
  return definition
}

function registerSlot(script: string) {
  const ast = parseJsLike(script)
  const globals: Record<string, unknown> = {}
  ast.program.body = ast.program.body.filter((statement) => {
    if (!t.isImportDeclaration(statement)) {
      return true
    }
    if (statement.source.value !== WE_VU_COMPILER_RUNTIME_MODULE_ID) {
      throw new Error(`Unexpected runtime module: ${statement.source.value}`)
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        throw new Error('Expected a named runtime import')
      }
      const name = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
      globals[specifier.local.name] = Reflect.get(runtime, name)
    }
    return false
  })
  runInNewContext(generate(ast).code, globals)
  return latestDefinition()
}

function mount(definition: Record<string, any>, owner?: Record<string, any>, properties: Record<string, unknown> = {}) {
  const target: Record<string, any> = {
    data: { ...definition.data },
    properties,
    selectOwnerComponent: () => owner,
    setData(_payload: unknown, callback?: () => void) { callback?.() },
  }
  mounted.push({ definition, target })
  definition.lifetimes.created?.call(target)
  definition.lifetimes.attached.call(target)
  return target
}

function evaluateAttribute(value: string, owner: Record<string, any>) {
  if (!value.startsWith('{{') || !value.endsWith('}}')) {
    return value
  }
  return runInNewContext(`(function () { with (scope) { return (${value.slice(2, -2)}) } })()`, {
    scope: owner.__wevu.proxy,
  })
}

function mountCompiledSlots(source: string, options?: TemplateCompileOptions) {
  const compiled = compileVueTemplateToWxml(source, 'src/pages/slot-context/index.vue', {
    scopedSlotsRequireProps: false,
    wevuComponentTags: ['Provider', 'Leaf'],
    ...options,
  })
  expect(compiled.diagnostics).toEqual([])
  const slots = new Map((compiled.scopedSlotComponents ?? []).map(asset => [asset.componentName, {
    definition: registerSlot(asset.script),
    children: baseParse(asset.template).children,
  }]))
  const token = Symbol('counter-context')
  const declaration = reactivity.ref('declaration')
  const providers = new Map<string, CounterContext>()
  const leaves = new Map<string, { context: CounterContext | undefined, declaration: () => unknown }>()
  runtime.defineComponent({
    [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
    setup: () => ({ label: declaration }),
  })
  const page = mount(latestDefinition())

  // 只重放编译产物中的静态组件和泛型边界；真实 slot 投影仍由双宿主 E2E 验证。
  // 原生投影节点保留声明 owner，泛型组件则由接收插槽的宿主创建。
  function visit(children: TemplateChildNode[], owner: Record<string, any>) {
    for (const node of children) {
      if (node.type !== NodeTypes.ELEMENT) {
        continue
      }
      const attrs = Object.fromEntries(node.props.map((prop) => {
        if (prop.type !== NodeTypes.ATTRIBUTE) {
          throw new Error('Expected compiled native attributes')
        }
        return [prop.name, prop.value?.content ?? '']
      }))
      if (node.tag === 'provider') {
        const label = String(evaluateAttribute(attrs.label!, owner))
        const count = reactivity.ref(Number(evaluateAttribute(attrs.seed!, owner)))
        const context = { label, count, increment: () => count.value++ }
        providers.set(label, context)
        runtime.defineComponent({
          setup() {
            runtime.provide(token, context)
            return { label }
          },
        })
        const provider = mount(latestDefinition(), owner)
        for (const [name, value] of Object.entries(attrs)) {
          if (!name.startsWith('generic:')) {
            continue
          }
          const slot = slots.get(value)
          if (!slot) {
            throw new Error(`Missing generated slot asset: ${value}`)
          }
          const target = mount(slot.definition, provider, {
            [WEVU_SLOT_OWNER_ID_PROP]: evaluateAttribute(attrs[WEVU_SLOT_OWNER_ID_ATTR]!, owner),
            [WEVU_SLOT_SCOPE_KEY]: attrs[WEVU_SLOT_SCOPE_ATTR]
              ? evaluateAttribute(attrs[WEVU_SLOT_SCOPE_ATTR], owner)
              : null,
          })
          visit(slot.children, target)
        }
      }
      else if (node.tag === 'leaf') {
        const probe = attrs.probe!
        runtime.defineComponent({
          setup() {
            leaves.set(probe, {
              context: runtime.inject<CounterContext | undefined>(token, undefined),
              declaration: () => evaluateAttribute(attrs.declaration!, owner),
            })
            return {}
          },
        })
        mount(latestDefinition(), owner)
      }
      visit(node.children, owner)
    }
  }
  visit(baseParse(compiled.code).children, page)
  return { declaration, providers, leaves }
}

describe('augmented slot context boundaries', () => {
  it.each([undefined, 'augmented'] as const)('keeps nested wrapped and named consumers on the nearest provider in %s mode', async (scopedSlotsCompiler) => {
    const { declaration, providers, leaves } = mountCompiledSlots(`
<Provider label="outer" :seed="100">
  <Leaf probe="outer-before" :declaration="label" />
  <Provider label="inner" :seed="200">
    <view><Leaf probe="inner-wrapped" :declaration="label" /></view>
    <template #named><Leaf probe="inner-named" :declaration="label" /></template>
  </Provider>
  <Leaf probe="outer-after" :declaration="label" />
</Provider>`, { scopedSlotsCompiler })

    const outer = providers.get('outer')!
    const inner = providers.get('inner')!
    expect(leaves.get('outer-before')?.context).toBe(outer)
    expect(leaves.get('outer-after')?.context).toBe(outer)
    expect(leaves.get('inner-wrapped')?.context).toBe(inner)
    expect(leaves.get('inner-named')?.context).toBe(inner)
    expect(inner.count.value).toBe(200)
    leaves.get('inner-wrapped')!.context!.increment()
    expect(leaves.get('inner-named')!.context!.count.value).toBe(201)
    expect(outer.count.value).toBe(100)
    leaves.get('outer-after')!.context!.increment()
    expect(leaves.get('outer-before')!.context!.count.value).toBe(101)
    expect(inner.count.value).toBe(201)
    expect([...leaves.values()].map(leaf => leaf.declaration())).toEqual(Array.from({ length: 4 }).fill('declaration'))
    declaration.value = 'updated declaration'
    await nextTick()
    await nextTick()
    expect([...leaves.values()].map(leaf => leaf.declaration())).toEqual(Array.from({ length: 4 }).fill('updated declaration'))
  })

  it('preserves a provider boundary when its only default content is wrapped', () => {
    const { providers, leaves } = mountCompiledSlots(`
<Provider label="wrapped" :seed="7">
  <view><block><Leaf probe="wrapped" :declaration="label" /></block></view>
</Provider>`)
    const context = providers.get('wrapped')!
    expect(leaves.get('wrapped')?.context).toBe(context)
    expect(leaves.get('wrapped')?.declaration()).toBe('declaration')
    leaves.get('wrapped')!.context!.increment()
    expect(context.count.value).toBe(8)
  })
})
