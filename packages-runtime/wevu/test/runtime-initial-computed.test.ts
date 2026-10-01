import {
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { resolveInitialComputedData, resolveNativeInitialData } from '@/runtime/define/initialComputed'

describe('runtime: initial computed data', () => {
  it('evaluates only static compiler generated template computed bindings before setup', () => {
    const normalGetter = () => 'ready'
    const staticTemplateGetter = () => ({ default: true })
    const dynamicTemplateGetter = function (this: any) {
      return this.visible ? { default: true } : {}
    }
    const classGetter = () => {
      throw new Error('template computed should wait for runtime setup')
    }

    const result = resolveInitialComputedData({
      data: {},
      computed: {
        normal: normalGetter,
        __wv_bind_0: staticTemplateGetter,
        __wv_bind_1: dynamicTemplateGetter,
        __wv_cls_0: classGetter,
        __wv_style_0: classGetter,
      },
      setData: undefined,
    })

    expect(result).toEqual({
      normal: 'ready',
      __wv_bind_0: { default: true },
    })
  })

  it('predeclares unresolved picked runtime slot binding keys without evaluating dynamic template computed', () => {
    const staticTemplateGetter = () => ({ default: true })
    const dynamicTemplateGetter = function (this: any) {
      return this.visible ? { header: true } : {}
    }
    const data = { tick: 0 }

    const result = resolveNativeInitialData(
      data,
      {
        __wv_bind_0: staticTemplateGetter,
        __wv_bind_1: dynamicTemplateGetter,
      },
      {
        pick: [
          WEVU_SLOT_OWNER_ID_KEY,
          '__wv_bind_0',
          '__wv_bind_1',
          'tick',
        ],
        strategy: 'patch',
      },
    )

    expect(result).toEqual({
      tick: 0,
      [WEVU_SLOT_OWNER_ID_KEY]: '',
      __wv_bind_0: { default: true },
      __wv_bind_1: null,
    })
  })

  it('evaluates computed getters that call component methods', () => {
    const result = resolveInitialComputedData({
      data: { count: 0 },
      methods: {
        increment() {
          return this.count + 1
        },
      },
      computed: { value(this: any) { return this.increment() } },
      setData: undefined,
    })
    expect(result).toEqual({ value: 1 })
  })

  it('respects selection and existing data when declaring manifest placeholders', () => {
    const data = { __wv_style_0: 'color:red', value: 1 }
    const result = resolveNativeInitialData(data, undefined, {
      pick: ['__wv_style_0', '__wv_style_1', '__wv_cls_0', 'value'],
      omit: ['__wv_style_1'],
    }, undefined, {
      version: 1,
      sourceFile: 'src/style.vue',
      bindings: ['__wv_style_0', '__wv_style_1', '__wv_style_2', '__wv_cls_0', 'value']
        .map(outputPath => ({ id: outputPath, outputPath })),
    })
    expect(result).toEqual({ ...data, __wv_cls_0: '' })
    expect(data).toEqual({ __wv_style_0: 'color:red', value: 1 })
  })

  it('does not manufacture nested binding keys or ordinary setup data', () => {
    const result = resolveNativeInitialData(undefined, undefined, undefined, undefined, {
      version: 1,
      sourceFile: 'src/style.vue',
      bindings: ['__wv_style_0.color', '__wv_style_1[0]', 'value', '*']
        .map(outputPath => ({ id: outputPath, outputPath })),
    })
    expect(result).toBeUndefined()
  })

  it('keeps ordinary computed evaluation deferred when native data is absent', () => {
    let calls = 0
    const result = resolveNativeInitialData(undefined, {
      ordinary() {
        calls += 1
        return 'ready'
      },
    }, { pick: ['__wv_style_0'] })
    expect(result).toEqual({ __wv_style_0: '' })
    expect(calls).toBe(0)
  })
})
