import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from '@/index'
import { runInlineExpression } from '@/runtime/register/inline'

const registeredComponents: Record<string, any>[] = []

;(globalThis as any).Component = (options: Record<string, any>) => {
  registeredComponents.push(options)
}

describe('runtime: inline event handler', () => {
  it('executes inline expression with $event and keeps native event as arg', () => {
    const handle = vi.fn((msg: string, evt: any) => ({ msg, marker: evt.marker }))

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
      },
    }
    const event = {
      marker: 42,
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: '["ok","$event"]',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
    expect(result).toEqual({ msg: 'ok', marker: 42 })
  })

  it('accepts array args from dataset', () => {
    const handle = vi.fn((msg: string, evt: any) => ({ msg, marker: evt.marker }))

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
      },
    }
    const event = {
      marker: 42,
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: ['ok', '$event'],
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
    expect(result).toEqual({ msg: 'ok', marker: 42 })
  })

  it('decodes WXML entities in wvArgs before JSON parse', () => {
    const handle = vi.fn((msg: string, evt: any) => ({ msg, marker: evt.marker }))

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
      },
    }
    const event = {
      marker: 42,
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: '[&quot;ok&quot;,&quot;$event&quot;]',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
    expect(result).toEqual({ msg: 'ok', marker: 42 })
  })

  it('executes inline map with scope bindings', () => {
    const handle = vi.fn((first: string, second: string, marker: number) => ({ first, second, marker }))
    const inlineMap = {
      __wv_inline_0: {
        keys: ['first', 'second'],
        fn: (ctx: any, scope: Record<string, any>, evt: any) => ctx.handle(scope.first, scope.second, evt.marker),
      },
    }

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
        __weapp_vite_inline_map: inlineMap,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
        methods: {
          __weapp_vite_inline_map: inlineMap,
        },
      },
    }
    const event = {
      marker: 7,
      currentTarget: {
        dataset: {
          wvInlineId: '__wv_inline_0',
          wvS0: 'alpha',
          wvS1: 'beta',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('alpha', 'beta', 7)
    expect(result).toEqual({ first: 'alpha', second: 'beta', marker: 7 })
  })

  it('executes function result from inline map', () => {
    const handle = vi.fn((value: number) => value)
    const inlineMap = {
      __wv_inline_0: {
        keys: [],
        fn: (ctx: any, _scope: Record<string, any>, evt: any) => () => ctx.handle(evt.marker),
      },
    }

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
        __weapp_vite_inline_map: inlineMap,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
        methods: {
          __weapp_vite_inline_map: inlineMap,
        },
      },
    }
    const event = {
      marker: 3,
      currentTarget: {
        dataset: {
          wvInlineId: '__wv_inline_0',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith(3)
    expect(result).toBe(3)
  })

  it('executes inline map from options methods after mount', () => {
    const handle = vi.fn((value: string) => value)
    const inlineMap = {
      __wv_inline_0: {
        keys: ['item'],
        fn: (ctx: any, scope: Record<string, any>) => ctx.handle(scope.item),
      },
    }

    defineComponent({
      methods: {
        __weapp_vite_inline_map: inlineMap,
      },
      setup() {
        return { handle }
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      properties: {},
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }

    opts.lifetimes.attached.call(inst)
    const event = {
      currentTarget: {
        dataset: {
          wvInlineId: '__wv_inline_0',
          wvS0: 'alpha',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('alpha')
    expect(result).toBe('alpha')
  })

  it('returns undefined when handler missing', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
    })
    const opts = registeredComponents.pop()
    const inst: any = { __wevu: { proxy: {} } }
    const event = {
      currentTarget: {
        dataset: {
          wvHandler: 'notFound',
          wvArgs: '["$event"]',
        },
      },
    }
    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(result).toBeUndefined()
  })

  it('restores v-for object argument identity from source list', () => {
    const source = [
      { id: 1, quantity: 2 },
      { id: 2, quantity: 5 },
    ]
    const itemSnapshot = { id: 1, quantity: 2 }
    const updateQuantity = vi.fn((item: { quantity: number }, delta: number) => {
      if (item.quantity <= 1 && delta < 0) {
        return
      }
      item.quantity = Math.max(1, item.quantity + delta)
    })

    const inlineMap = {
      __wv_inline_0: {
        keys: ['item'],
        indexKeys: ['__wv_i0'],
        scopeResolvers: [
          (ctx: any, scope: Record<string, any>) => ctx.items?.[scope.__wv_i0],
        ],
        fn: (ctx: any, scope: Record<string, any>) => ctx.updateQuantity(scope.item, -1),
      },
    }

    runInlineExpression(
      {
        items: source,
        updateQuantity,
      },
      undefined,
      {
        currentTarget: {
          dataset: {
            wvInlineId: '__wv_inline_0',
            wvS0: itemSnapshot,
            wvI0: 0,
          },
        },
      },
      inlineMap as any,
    )

    expect(updateQuantity).toHaveBeenCalledTimes(1)
    expect(source[0].quantity).toBe(1)
    expect(source[1].quantity).toBe(5)
    expect(itemSnapshot.quantity).toBe(2)
  })
})
