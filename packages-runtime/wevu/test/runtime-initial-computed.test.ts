import { describe, expect, it } from 'vitest'
import { resolveInitialComputedData } from '@/runtime/define/initialComputed'

describe('runtime: initial computed data', () => {
  it('does not evaluate compiler generated template computed bindings before setup', () => {
    const normalGetter = () => 'ready'
    const templateGetter = () => {
      throw new Error('template computed should wait for runtime setup')
    }

    const result = resolveInitialComputedData({
      data: {},
      computed: {
        normal: normalGetter,
        __wv_bind_0: templateGetter,
        __wv_cls_0: templateGetter,
        __wv_style_0: templateGetter,
      },
      setData: undefined,
    })

    expect(result).toEqual({ normal: 'ready' })
  })
})
