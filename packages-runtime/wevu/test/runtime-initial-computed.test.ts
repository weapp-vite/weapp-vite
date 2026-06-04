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
})
