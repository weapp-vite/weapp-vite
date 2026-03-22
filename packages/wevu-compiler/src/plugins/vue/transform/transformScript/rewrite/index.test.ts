import type { WevuPageFeatureFlag } from '../../../../wevu/pageFeatures/types'
import type { TransformScriptOptions, TransformState } from '../utils'
import { describe, expect, it, vi } from 'vitest'
import { generate, parseJsLike, traverse } from '../../../../../utils/babel'
import { createCollectVisitors } from '../collect'
import { rewriteDefaultExport } from './index'

const WEVU_IS_PAGE_RE = /__wevu_isPage/g

function createState(ast: any): TransformState {
  const state: TransformState = {
    transformed: false,
    defineComponentAliases: new Set(['defineComponent', '_defineComponent']),
    defineComponentDecls: new Map(),
    defaultExportPath: null,
  }
  traverse(ast, createCollectVisitors(state) as any)
  return state
}

function runRewrite(
  source: string,
  options?: TransformScriptOptions,
  enabledPageFeatures: Set<WevuPageFeatureFlag> = new Set<WevuPageFeatureFlag>(),
  serializedWevuDefaults?: string,
  parsedWevuDefaults?: any,
) {
  const ast = parseJsLike(source)
  const state = createState(ast)
  const transformed = rewriteDefaultExport(
    ast,
    state,
    options,
    enabledPageFeatures,
    serializedWevuDefaults,
    parsedWevuDefaults,
  )
  return {
    transformed,
    code: generate(ast).code,
  }
}

describe('rewriteDefaultExport', () => {
  it('returns false when no default export path is collected', () => {
    const ast = parseJsLike('const value = 1')
    const state: TransformState = {
      transformed: false,
      defineComponentAliases: new Set(['defineComponent', '_defineComponent']),
      defineComponentDecls: new Map(),
      defaultExportPath: null,
    }

    const transformed = rewriteDefaultExport(
      ast,
      state,
      undefined,
      new Set<WevuPageFeatureFlag>(),
      undefined,
      undefined,
    )

    expect(transformed).toBe(false)
  })

  it('injects page marker and page features into options object', () => {
    const { transformed, code } = runRewrite(
      'export default { setup() {} }',
      { isPage: true },
      new Set<WevuPageFeatureFlag>(['enableOnReachBottom']),
    )

    expect(transformed).toBe(true)
    expect(code).toContain('__wevu_isPage: true')
    expect(code).toContain('enableOnReachBottom: true')
    expect(code).toContain('createWevuComponent')
  })

  it('detects existing page marker through Object.assign and spread chain', () => {
    const { code } = runRewrite(`
const marker = ({ __wevu_isPage: true } as const)
const merged = Object.assign({}, marker)
export default (Object.assign({}, merged, { data: {} }) as any)
    `.trim(), {
      isPage: true,
    })

    const markerCount = (code.match(WEVU_IS_PAGE_RE) ?? []).length
    expect(markerCount).toBe(1)
  })

  it('warns when class/style/templateRef/layoutHost/inline metadata cannot be injected', () => {
    const warn = vi.fn()
    const { transformed, code } = runRewrite(
      'export default defineComponent(resolveOptions())',
      {
        classStyleBindings: [
          {
            name: '__wv_cls_0',
            type: 'class',
            exp: 'foo',
            forStack: [],
          },
        ],
        templateRefs: [
          {
            selector: '.card',
            inFor: false,
          },
        ],
        layoutHosts: [
          {
            key: 'dialog',
            refName: '__wevu_layout_host_0',
            selector: '#__wv-layout-host-0',
            kind: 'component',
          },
        ],
        inlineExpressions: [
          {
            id: 'e0',
            expression: 'foo',
            scopeKeys: ['foo'],
          },
        ],
        warn,
      },
    )

    expect(transformed).toBe(true)
    expect(code).toContain('createWevuComponent')
    expect(warn).toHaveBeenCalledTimes(4)
    expect(warn.mock.calls.map(call => call[0])).toEqual([
      '无法自动注入 class/style 计算属性：组件选项不是对象字面量。',
      '无法自动注入 template ref 元数据：组件选项不是对象字面量。',
      '无法自动注入 layout host 元数据：组件选项不是对象字面量。',
      '无法自动注入内联表达式元数据：组件选项不是对象字面量。',
    ])
  })

  it('warns when inline expression target methods is not object literal', () => {
    const warn = vi.fn()
    const { transformed, code } = runRewrite(
      'export default { methods: sharedMethods }',
      {
        inlineExpressions: [
          {
            id: 'e1',
            expression: 'foo + 1',
            scopeKeys: ['foo'],
          },
        ],
        warn,
      },
    )

    expect(transformed).toBe(true)
    expect(code).not.toContain('__weapp_vite_inline_map')
    expect(warn).toHaveBeenCalledWith('无法自动注入内联表达式元数据：methods 不是对象字面量。')
  })

  it('injects class/style/templateRefs/layoutHosts/inline metadata into object options', () => {
    const { code } = runRewrite(
      'export default { computed: baseComputed, methods: {} }',
      {
        classStyleBindings: [
          {
            name: '__wv_cls_1',
            type: 'class',
            exp: 'bar',
            forStack: [],
          },
        ],
        templateRefs: [
          {
            selector: '#id',
            inFor: true,
          },
        ],
        layoutHosts: [
          {
            key: 'toast',
            refName: '__wevu_layout_host_1',
            selector: '#__wv-layout-host-1',
            kind: 'component',
          },
        ],
        inlineExpressions: [
          {
            id: 'e2',
            expression: 'bar',
            scopeKeys: ['bar'],
          },
        ],
      },
    )

    expect(code).toContain('__wevuNormalizeClass')
    expect(code).toContain('...baseComputed')
    expect(code).toContain('__wevuTemplateRefs')
    expect(code).toContain('__wevuLayoutHosts')
    expect(code).toContain('__weapp_vite_inline_map')
  })

  it('injects static setup seeds into data for first paint', () => {
    const { code } = runRewrite(
      `
export default {
  setup() {
    const value1 = ref('111')
    const count = 2
    const readyState = reactive({ ready: true })
    const Comp = { __weappViteUsingComponent: true, name: 'Comp', from: '/components/Comp/index' }
    const __returned__ = { value1, count, readyState, Comp }
    return __returned__
  },
}
      `.trim(),
    )

    expect(code).toContain('data()')
    expect(code).toContain('value1: \'111\'')
    expect(code).toContain('count: 2')
    expect(code).toContain('readyState: {')
    expect(code).not.toContain('Comp: { __weappViteUsingComponent: true')
  })

  it('merges inline map with methods from spread defineOptions object', () => {
    const warn = vi.fn()
    const { transformed, code } = runRewrite(
      `
const __default__ = {
  methods: {
    onChange(event) {
      return event
    },
  },
}
export default {
  ...__default__,
  setup() {},
}
      `.trim(),
      {
        inlineExpressions: [
          {
            id: 'e-spread-merge',
            expression: 'onChange($event)',
            scopeKeys: [],
          },
        ],
        warn,
      },
    )

    expect(transformed).toBe(true)
    expect(code).toContain('methods: Object.assign({}, __default__?.methods || {}')
    expect(code).toContain('__weapp_vite_inline_map')
    expect(warn).not.toHaveBeenCalled()
  })

  it('handles app mode defaults injection and skip component transform mode', () => {
    const serializedWevuDefaults = JSON.stringify({
      app: {
        debug: true,
      },
    })
    const appResult = runRewrite(
      'export default { onLaunch() {} }',
      { isApp: true },
      new Set<WevuPageFeatureFlag>(),
      serializedWevuDefaults,
      JSON.parse(serializedWevuDefaults),
    )
    expect(appResult.code).toContain('setWevuDefaults')
    expect(appResult.code).toContain('createApp')
    expect(appResult.code).not.toContain('createWevuComponent')

    const skipResult = runRewrite(
      'export default { name: "demo" }',
      { skipComponentTransform: true },
    )
    expect(skipResult.code).toContain('export default')
    expect(skipResult.code).not.toContain('__wevuOptions')
    expect(skipResult.code).not.toContain('createWevuComponent')
  })
})
