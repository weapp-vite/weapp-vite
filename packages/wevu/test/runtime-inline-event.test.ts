import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from '@/index'
import { isReactive, ref } from '@/reactivity'
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

  it('uses event.detail as $event when component event marker is set', () => {
    const handle = vi.fn((payload: any) => payload.title)

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
      detail: { title: 'Alt Script Setup 面板' },
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: ['$event'],
          wvEventDetail: '1',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith({ title: 'Alt Script Setup 面板' })
    expect(result).toBe('Alt Script Setup 面板')
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

  it('passes event.detail to inline map when component event marker is set', () => {
    const handle = vi.fn((title: string) => title)
    const inlineMap = {
      __wv_inline_0: {
        keys: [],
        fn: (ctx: any, _scope: Record<string, any>, payload: any) => ctx.handle(payload.title),
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
      detail: { title: 'script setup payload' },
      currentTarget: {
        dataset: {
          wvInlineId: '__wv_inline_0',
          wvEventDetail: '1',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('script setup payload')
    expect(result).toBe('script setup payload')
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

  it('restores v-for object argument identity from resolver metadata object', () => {
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
          {
            type: 'for-item',
            path: 'items',
            indexKey: '__wv_i0',
          },
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

  it('resolves list path from ref-like source for resolver metadata object', () => {
    const source = ref([
      { id: 1, quantity: 2 },
      { id: 2, quantity: 5 },
    ])
    const itemSnapshot = { id: 1, quantity: 2 }
    const updateQuantity = vi.fn((item: { quantity: number }, delta: number) => {
      item.quantity = Math.max(1, item.quantity + delta)
    })

    const inlineMap = {
      __wv_inline_0: {
        keys: ['item'],
        indexKeys: ['__wv_i0'],
        scopeResolvers: [
          {
            type: 'for-item',
            path: 'items',
            indexKey: '__wv_i0',
          },
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
    expect(source.value[0].quantity).toBe(1)
    expect(source.value[1].quantity).toBe(5)
    expect(itemSnapshot.quantity).toBe(2)
  })

  it('normalizes restored list item to reactive proxy before invoking handler', () => {
    const source = [{ id: 1, quantity: 2 }]
    const itemSnapshot = { id: 1, quantity: 2 }
    const updateQuantity = vi.fn((item: { quantity: number }) => {
      expect(isReactive(item)).toBe(true)
      item.quantity -= 1
    })

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
      {
        __wv_inline_0: {
          keys: ['item'],
          indexKeys: ['__wv_i0'],
          scopeResolvers: [
            {
              type: 'for-item',
              path: 'items',
              indexKey: '__wv_i0',
            },
          ],
          fn: (ctx: any, scope: Record<string, any>) => ctx.updateQuantity(scope.item),
        },
      } as any,
    )

    expect(updateQuantity).toHaveBeenCalledTimes(1)
    expect(source[0].quantity).toBe(1)
    expect(itemSnapshot.quantity).toBe(2)
  })

  it('updates nested object fields through restored v-for item identity', () => {
    const source = [
      { id: 1, meta: { count: 1 } },
      { id: 2, meta: { count: 4 } },
    ]
    const itemSnapshot = { id: 1, meta: { count: 1 } }
    const bump = vi.fn((item: { meta: { count: number } }) => {
      item.meta.count += 1
    })

    runInlineExpression(
      {
        items: source,
        bump,
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
      {
        __wv_inline_0: {
          keys: ['item'],
          indexKeys: ['__wv_i0'],
          scopeResolvers: [
            {
              type: 'for-item',
              path: 'items',
              indexKey: '__wv_i0',
            },
          ],
          fn: (ctx: any, scope: Record<string, any>) => ctx.bump(scope.item),
        },
      } as any,
    )

    expect(bump).toHaveBeenCalledTimes(1)
    expect(source[0].meta.count).toBe(2)
    expect(source[1].meta.count).toBe(4)
    expect(itemSnapshot.meta.count).toBe(1)
  })

  it('updates only the clicked list item without mutating neighbors', () => {
    const source = [
      { id: 1, quantity: 2 },
      { id: 2, quantity: 5 },
      { id: 3, quantity: 9 },
    ]
    const itemSnapshot = { id: 2, quantity: 5 }
    const updateQuantity = vi.fn((item: { quantity: number }, delta: number) => {
      item.quantity += delta
    })

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
            wvI0: 1,
          },
        },
      },
      {
        __wv_inline_0: {
          keys: ['item'],
          indexKeys: ['__wv_i0'],
          scopeResolvers: [
            {
              type: 'for-item',
              path: 'items',
              indexKey: '__wv_i0',
            },
          ],
          fn: (ctx: any, scope: Record<string, any>) => ctx.updateQuantity(scope.item, 1),
        },
      } as any,
    )

    expect(updateQuantity).toHaveBeenCalledTimes(1)
    expect(source[0].quantity).toBe(2)
    expect(source[1].quantity).toBe(6)
    expect(source[2].quantity).toBe(9)
    expect(itemSnapshot.quantity).toBe(5)
  })

  it('keeps class toggle source in sync after inline v-for object arg mutation', () => {
    const source = [
      { id: 1, checked: false },
      { id: 2, checked: true },
    ]
    const itemSnapshot = { id: 1, checked: false }
    const toggle = vi.fn((item: { checked: boolean }) => {
      item.checked = !item.checked
    })
    const classOf = (item: { checked: boolean }) => item.checked ? 'row-checked' : 'row-unchecked'

    expect(classOf(source[0])).toBe('row-unchecked')

    runInlineExpression(
      {
        items: source,
        toggle,
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
      {
        __wv_inline_0: {
          keys: ['item'],
          indexKeys: ['__wv_i0'],
          scopeResolvers: [
            {
              type: 'for-item',
              path: 'items',
              indexKey: '__wv_i0',
            },
          ],
          fn: (ctx: any, scope: Record<string, any>) => ctx.toggle(scope.item),
        },
      } as any,
    )

    expect(toggle).toHaveBeenCalledTimes(1)
    expect(source[0].checked).toBe(true)
    expect(classOf(source[0])).toBe('row-checked')
    expect(source[1].checked).toBe(true)
    expect(itemSnapshot.checked).toBe(false)
  })

  it('keeps primitive inline args behavior unchanged while restoring object identity', () => {
    const source = [{ id: 1, quantity: 2 }]
    const itemSnapshot = { id: 1, quantity: 2 }
    const handle = vi.fn((item: { quantity: number }, delta: number, label: string) => {
      item.quantity += delta
      return label
    })

    const result = runInlineExpression(
      {
        items: source,
        handle,
      },
      undefined,
      {
        currentTarget: {
          dataset: {
            wvInlineId: '__wv_inline_0',
            wvS0: itemSnapshot,
            wvS1: -1,
            wvS2: 'minus',
            wvI0: 0,
          },
        },
      },
      {
        __wv_inline_0: {
          keys: ['item', 'delta', 'label'],
          indexKeys: ['__wv_i0'],
          scopeResolvers: [
            {
              type: 'for-item',
              path: 'items',
              indexKey: '__wv_i0',
            },
            undefined,
            undefined,
          ],
          fn: (ctx: any, scope: Record<string, any>) => ctx.handle(scope.item, scope.delta, scope.label),
        },
      } as any,
    )

    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith(source[0], -1, 'minus')
    expect(result).toBe('minus')
    expect(source[0].quantity).toBe(1)
    expect(itemSnapshot.quantity).toBe(2)
  })

  it('keeps 100-item inline resolver execution within baseline bounds', () => {
    const source = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      quantity: 2,
    }))
    const updateQuantity = vi.fn((item: { quantity: number }) => {
      item.quantity -= 1
    })

    const inlineMap = {
      __wv_inline_0: {
        keys: ['item'],
        indexKeys: ['__wv_i0'],
        scopeResolvers: [
          {
            type: 'for-item',
            path: 'items',
            indexKey: '__wv_i0',
          },
        ],
        fn: (ctx: any, scope: Record<string, any>) => ctx.updateQuantity(scope.item),
      },
    }

    const startedAt = Date.now()
    for (let index = 0; index < source.length; index += 1) {
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
              wvS0: { ...source[index] },
              wvI0: index,
            },
          },
        },
        inlineMap as any,
      )
    }
    const durationMs = Date.now() - startedAt

    expect(updateQuantity).toHaveBeenCalledTimes(100)
    expect(source.every(item => item.quantity === 1)).toBe(true)
    expect(durationMs).toBeLessThan(300)
  })
})
