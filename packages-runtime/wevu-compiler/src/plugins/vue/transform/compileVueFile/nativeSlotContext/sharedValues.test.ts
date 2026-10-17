import type { CompileVueFileOptions } from '../types'
import { runInNewContext } from 'node:vm'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_DECLARATION_EVENT, WEVU_NATIVE_DECLARATION_METHOD, WEVU_NATIVE_SLOT_CONTEXT_KEY, WEVU_NATIVE_SLOT_PARENT_EVENT, WEVU_NATIVE_SLOT_PARENT_METHOD } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as runtime from '../../../../../../../wevu/src/internal-runtime'
import * as templateRuntime from '../../../../../../../wevu/src/internal-template'
import * as reactivity from '../../../../../../../wevu/src/reactivity'
import { WE_VU_COMPILER_REACTIVITY_MODULE_ID, WE_VU_COMPILER_RUNTIME_MODULE_ID, WE_VU_COMPILER_TEMPLATE_MODULE_ID } from '../../../../../constants'
import { generate, parseJsLike } from '../../../../../utils/babel'
import { getMiniProgramTemplatePlatform } from '../../../compiler/template'
import { compileVueFile } from '../index'

/** 使用同一份模块导出对象链接实际编译结果，保留外部 importer 修改共享对象的语义。 */
function evaluateModule(source: string, modules: Record<string, Record<string, any>>) {
  const ast = parseJsLike(source)
  const exports: Record<string, any> = {}
  const globals: Record<string, any> = { exports, modules }
  ast.program.body = ast.program.body.flatMap<t.Statement>((statement) => {
    if (t.isImportDeclaration(statement)) {
      const module = modules[statement.source.value]
      if (!module) {
        throw new Error(`Unexpected import ${statement.source.value}`)
      }
      for (const specifier of statement.specifiers) {
        globals[specifier.local.name] = t.isImportNamespaceSpecifier(specifier) ? module : module[t.isImportDefaultSpecifier(specifier) ? 'default' : t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value]
      }
      return []
    }
    if (t.isExportDefaultDeclaration(statement) && t.isExpression(statement.declaration)) {
      return [t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('exports'), t.identifier('default')), statement.declaration))]
    }
    if (t.isExportNamedDeclaration(statement)) {
      const names = statement.declaration ? Object.keys(t.getBindingIdentifiers(statement.declaration)) : []
      const assignments = names.map(name => t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('exports'), t.stringLiteral(name), true), t.identifier(name))))
      for (const specifier of statement.specifiers) {
        if (t.isExportSpecifier(specifier)) {
          const name = t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value
          const localName = t.isIdentifier(specifier.local) ? specifier.local.name : specifier.local.value
          const value = statement.source ? t.memberExpression(t.memberExpression(t.identifier('modules'), t.stringLiteral(statement.source.value), true), t.stringLiteral(localName), true) : specifier.local
          assignments.push(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('exports'), t.stringLiteral(name), true), value)))
        }
      }
      return statement.declaration ? [statement.declaration, ...assignments] : assignments
    }
    return [statement]
  })
  runInNewContext(generate(ast).code, globals)
  return exports
}

function createHost(definition: Record<string, any>, owner?: Record<string, any>) {
  return {
    data: {} as Record<string, any>,
    properties: {} as Record<string, any>,
    ...definition.methods,
    setData(value: Record<string, any>, callback?: () => void) {
      Object.assign(this.data, value)
      callback?.()
    },
    selectOwnerComponent() { return owner },
    triggerEvent(name: string, detail: unknown) {
      if (name === WEVU_NATIVE_SLOT_PARENT_EVENT) {
        owner?.[WEVU_NATIVE_SLOT_PARENT_METHOD]?.({ detail, currentTarget: { dataset: {} } })
      }
      if (name === WEVU_NATIVE_DECLARATION_EVENT) {
        owner?.[WEVU_NATIVE_DECLARATION_METHOD]?.({ detail })
      }
    },
  }
}

async function createProviderFixture(child: string, stateSource?: string) {
  const provider = '<script setup>import { provide } from "wevu"; provide("token", "nearest-provider")</script><template><slot /></template>'
  const root = '<script setup>import { provide } from "wevu"; import Provider from "./Provider.vue"; import Child from "./Child.vue"; provide("token", "outer-provider")</script><template><Provider><Child /></Provider></template>'
  const files: Record<string, string> = { '/project/Provider.vue': provider, '/project/Child.vue': child }
  if (stateSource) {
    files['/project/state.js'] = stateSource
    files['/project/barrel.js'] = 'export { state } from "./state.js"'
  }
  const options: CompileVueFileOptions = {
    sourceMap: false,
    skipComponentTransform: true,
    template: { platform: getMiniProgramTemplatePlatform('weapp'), scopedSlotsRequireProps: true, nativeSlotContext: true },
    sfcSrc: {
      resolveId: async source => source.startsWith('./') ? `/project/${source.slice(2)}` : source.startsWith('/project/') ? source : undefined,
      readFile: async (id) => {
        if (!(id in files)) {
          throw new Error(`Missing fixture ${id}`)
        }
        return files[id]!
      },
    },
    autoUsingComponents: { enabled: true, resolveUsingComponentPath: async source => ({ from: `/components/${source.slice(2, -4)}`, resolvedId: `/project/${source.slice(2)}`, sourceType: 'wevu-sfc' }) },
  }
  const childOutput = await compileVueFile(child, '/project/Child.vue', options)
  const providerOutput = await compileVueFile(provider, '/project/Provider.vue', options)
  const rootOutput = await compileVueFile(root, '/project/Root.vue', options)
  const modules: Record<string, Record<string, any>> = {
    wevu: { ...runtime, ...reactivity },
    [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime,
    [WE_VU_COMPILER_REACTIVITY_MODULE_ID]: reactivity,
    [WE_VU_COMPILER_TEMPLATE_MODULE_ID]: templateRuntime,
  }
  if (stateSource) {
    modules['./state.js'] = evaluateModule(stateSource, modules)
    modules['./barrel.js'] = evaluateModule(files['/project/barrel.js']!, modules)
  }
  modules['./Child.vue'] = evaluateModule(childOutput.script!, modules)
  const childOptions = modules['./Child.vue']!.default
  const providerOptions = evaluateModule(providerOutput.script!, modules).default
  modules['./Provider.vue'] = { default: providerOptions }
  const rootOptions = evaluateModule(rootOutput.script!, modules).default
  const register = vi.fn()
  vi.stubGlobal('Component', register)
  const definitions = [rootOptions, providerOptions, childOptions].map((value) => {
    runtime.createWevuComponent(value)
    return register.mock.lastCall![0]
  })
  const rootHost = createHost(definitions[0])
  const providerHost = createHost(definitions[1], rootHost)
  const childHost = createHost(definitions[2], rootHost)
  const nodes = baseParse(rootOutput.template!).children[0]
  if (nodes?.type !== NodeTypes.ELEMENT || nodes.children[0]?.type !== NodeTypes.ELEMENT) {
    throw new Error('Expected Provider and projected Child')
  }
  for (const [node, host] of [[nodes, providerHost], [nodes.children[0], childHost]] as const) {
    const attribute = node.props.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === WEVU_NATIVE_DECLARATION_ADDRESS_PROP)
    if (attribute?.type === NodeTypes.ATTRIBUTE && attribute.value) {
      host.properties[WEVU_NATIVE_DECLARATION_ADDRESS_PROP] = runInNewContext(attribute.value.content.replace(/^\{\{|\}\}$/g, ''))
    }
  }
  return {
    modules,
    childOptions,
    childOutput,
    mount(check: (host: typeof childHost) => void) {
      const hosts = [rootHost, providerHost, childHost]
      let attached = 0
      try {
        for (let index = 0; index < hosts.length; index++) {
          attached++
          definitions[index].lifetimes.created.call(hosts[index])
          definitions[index].lifetimes.attached.call(hosts[index])
        }
        check(childHost)
        expect(childOptions[WEVU_NATIVE_SLOT_CONTEXT_KEY]).toBe(true)
        expect(childHost.properties[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]).toBeDefined()
        expect(definitions[2].observers).toHaveProperty(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)
      }
      finally {
        for (let index = attached - 1; index >= 0; index--) {
          definitions[index].lifetimes.detached.call(hosts[index])
        }
      }
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('native context shared module ownership', () => {
  it.each([
    ['named object', 'export const state = { token: 0 }', 'import { state } from "./state.js"; const label = state.token', 'token'],
    ['namespace object', 'export const state = { token: 0 }', 'import * as shared from "./state.js"; const label = shared.state.token', 'token'],
    ['barrel object', 'export const state = { token: 0 }', 'import { state } from "./barrel.js"; const label = state.token', 'token'],
    ['shared array', 'export const state = [0]', 'import { state } from "./state.js"; const label = state[0]', '0'],
    ['shared ref', 'import { ref } from "wevu"; export const state = ref(0)', 'import { state } from "./state.js"; const label = state.value', 'value'],
    ['singleton helper', 'export const state = { token: 0 }; export function useState() { return state }', 'import { useState } from "./state.js"; const label = useState().token', 'token'],
    ['shared field reader', 'export const state = { token: 0 }; export function readToken() { return state.token }', 'import { readToken } from "./state.js"; const label = readToken()', 'token'],
    ['shared ref identity helper', 'import { ref } from "wevu"; export const state = ref(0); export function useState() { return ref(state) }', 'import { useState } from "./state.js"; const label = useState().value', 'value'],
    ['shared property ref helper', 'import { toRef } from "wevu"; export const state = { token: 0 }; export function useState() { return toRef(state, "token") }', 'import { useState } from "./state.js"; const label = useState().value', 'token'],
    ['same SFC export', '<script>import { ref } from "wevu"; export const seed = ref(0)</script>', 'const label = seed.value', 'value'],
    ['same SFC exported getter', '<script>import { ref } from "wevu"; const seed = ref(0); export function getSeed() { return seed }</script>', 'const label = seed.value', 'value'],
  ])('keeps nearest provider on first setup after an external importer changes %s', async (_name, stateSource, childScript, key) => {
    const sameSfc = stateSource.startsWith('<script>')
    const child = `${sameSfc ? stateSource : ''}<script setup>${childScript}</script><template><text>{{ label }}</text></template>`
    const fixture = await createProviderFixture(child, sameSfc ? undefined : stateSource)
    const { modules } = fixture
    const observations: unknown[] = []
    modules['./mutator-observer.js'] = {
      observe(value: unknown) {
        observations.push(value)
        return value
      },
    }
    // Child 不导入这个 mutator；先修改同一导出实例，再进行首次 setup。
    const sharedImport = sameSfc
      ? stateSource.includes('getSeed') ? 'import { getSeed } from "./Child.vue"; const state = getSeed()' : 'import { seed as state } from "./Child.vue"'
      : 'import { state } from "./state.js"'
    evaluateModule(`${sharedImport}; import { inject } from 'wevu'; import { observe } from './mutator-observer.js'; Object.defineProperty(state, ${JSON.stringify(key)}, { get() { return observe(inject('token', 'fallback')) } })`, modules)
    expect(observations).toEqual([])
    fixture.mount((childHost) => {
      expect(childHost.data.label).toBe('nearest-provider')
      expect(observations[0]).toBe('nearest-provider')
    })
  })

  it.each([
    ['await', 'await state'],
    ['return', 'return state'],
  ])('keeps nearest provider during implicit then access from async %s', async (_name, body) => {
    const child = `<script setup>import { state } from './state.js'; async function read() { ${body} }; read()</script><template><text>child</text></template>`
    const fixture = await createProviderFixture(child, 'export const state = {}')
    const observations: unknown[] = []
    fixture.modules['./observations.js'] = { observations }
    evaluateModule(`import { state } from './state.js'; import { inject } from 'wevu'; import { observations } from './observations.js'; Object.defineProperty(state, 'then', { get() { observations.push(inject('token', 'fallback')); return undefined } })`, fixture.modules)
    expect(observations).toEqual([])
    fixture.mount(() => expect(observations).toEqual(['nearest-provider']))
  })

  it.each([
    ['defineExpose', '<script>const state = { token: 0 }</script><script setup>const label = state.token; defineExpose({ state })</script>'],
    ['setup return', '<script>const state = { token: 0 }; export default { setup() { const label = state.token; return { label, state } } }</script>'],
  ])('keeps nearest provider after an earlier instance shares module state through %s', async (escape, scripts) => {
    const fixture = await createProviderFixture(`${scripts}<template><text>{{ label }}</text></template>`)
    let exposed: Record<string, any> | undefined
    const returned = fixture.childOptions.setup({}, {
      expose(value: Record<string, any>) { exposed = value },
    })
    const state = (escape === 'defineExpose' ? exposed : returned)?.state
    expect(state).toEqual({ token: 0 })
    const observations: unknown[] = []
    Object.defineProperty(state, 'token', {
      get() {
        const value = runtime.inject('token', 'fallback')
        observations.push(value)
        return value
      },
    })
    fixture.mount((host) => {
      expect(host.data.label).toBe('nearest-provider')
      expect(observations[0]).toBe('nearest-provider')
    })
  })

  it.each([
    ['default value', '{}', '{ token = readToken() }', 'fallback'],
    ['computed key', '{ "nearest-provider": "selected" }', '{ [readToken()]: token = \'missing\' }', 'missing'],
  ])('retains protocol and execution of a loop pattern %s', async (_name, row, pattern, expected) => {
    const child = `<script setup>import { inject } from 'wevu'; const rows = [${row}]; const readToken = () => inject('token', 'fallback')</script><template><text v-for="(${pattern}, index) in rows">{{ token }}</text></template>`
    const fixture = await createProviderFixture(child)
    const node = baseParse(fixture.childOutput.template!).children[0]
    const loop = node?.type === NodeTypes.ELEMENT && node.props.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'wx:for')
    if (!loop || loop.type !== NodeTypes.ATTRIBUTE || !loop.value) {
      throw new Error('Expected emitted loop source')
    }
    // 投影在 setup 后求值，不保证 currentInstance；最近 provider 由上面的同步 setup 反例覆盖。
    const source = loop.value.content.replace(/^\{\{|\}\}$/g, '')
    fixture.mount(host => expect(runInNewContext(source, host.data)[0].token).toBe(expected))
  })

  it.each([
    ['object', 'export function useState() { return { token: 0 } }', 'token'],
    ['ref', 'import { ref } from "wevu"; export function useState() { return ref(0) }', 'value'],
  ])('preserves a fresh %s factory despite mutations to an earlier result', async (_name, source, key) => {
    const child = `<script setup>import { useState } from './factory.js'; const state = useState(); const increment = () => state.${key}++</script><template><button @click="increment">{{ state }}</button></template>`
    const output = await compileVueFile(child, '/project/Child.vue', {
      sourceMap: false,
      skipComponentTransform: true,
      template: { platform: getMiniProgramTemplatePlatform('weapp'), scopedSlotsRequireProps: true, nativeSlotContext: true },
      sfcSrc: {
        resolveId: async id => id === './factory.js' || id === '/project/factory.js' ? '/project/factory.js' : undefined,
        readFile: async () => source,
      },
    })
    const modules: Record<string, Record<string, any>> = {
      wevu: { ...runtime, ...reactivity },
      [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime,
      [WE_VU_COMPILER_REACTIVITY_MODULE_ID]: reactivity,
      [WE_VU_COMPILER_TEMPLATE_MODULE_ID]: templateRuntime,
    }
    modules['./factory.js'] = evaluateModule(source, modules)
    const previous = modules['./factory.js']!.useState()
    const getter = vi.fn(() => runtime.inject('token', 'fallback'))
    Object.defineProperty(previous, key, { get: getter })
    const options = evaluateModule(output.script!, modules).default
    expect(options[WEVU_NATIVE_SLOT_CONTEXT_KEY]).toBeUndefined()
    const state = options.setup({}, { expose() {} })
    expect(state.state[key]).toBe(0)
    state.increment()
    expect(state.state[key]).toBe(1)
    expect(getter).not.toHaveBeenCalled()
  })
})
