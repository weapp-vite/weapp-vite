import type { Ref } from '@/index'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, shallowRef } from '@/index'

interface NativeHost {
  properties: { back: unknown }
  data: Record<string, unknown>
  setData: (patch: Record<string, unknown>, callback?: () => void) => void
  triggerEvent: (name: string, detail: unknown) => void
  back?: () => number
}

interface NativeDefinition {
  lifetimes: Record<'created' | 'attached' | 'detached', (this: NativeHost) => void>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it.each([
  { name: 'Boolean', type: Boolean, value: false },
  { name: 'Function', type: Function, value: () => 'prop callback' },
])('preserves native method receivers separately from a same-name $name prop', async ({ type, value }) => {
  let definition!: NativeDefinition
  vi.stubGlobal('Component', (options: NativeDefinition) => {
    definition = options
  })
  defineComponent({
    props: { back: { type } },
    setup(_props, { emit }) {
      const calls = shallowRef(0)
      return {
        calls,
        back(this: { calls: Ref<number> }) {
          this.calls.value++
          emit('called', this.calls.value)
          return this.calls.value
        },
      }
    },
  })
  const events: Array<{ owner: string, name: string, detail: unknown }> = []
  const host: NativeHost = {
    properties: { back: value },
    data: {},
    setData(patch, callback) {
      Object.assign(this.data, patch)
      callback?.()
    },
    triggerEvent(name, detail) {
      events.push({ owner: 'original', name, detail })
    },
  }
  definition.lifetimes.created.call(host)
  definition.lifetimes.attached.call(host)
  await nextTick()
  try {
    expect(host.back!()).toBe(1)
    expect(host.properties.back).toBe(value)
    expect(events).toEqual([{ owner: 'original', name: 'called', detail: 1 }])

    const wrapper: NativeHost = Object.create(host)
    wrapper.triggerEvent = (name, detail) => {
      events.push({ owner: 'wrapper', name, detail })
    }
    expect(host.back!.call(wrapper)).toBe(2)
    expect(events).toEqual([
      { owner: 'original', name: 'called', detail: 1 },
      { owner: 'wrapper', name: 'called', detail: 2 },
    ])
    expect(host.properties.back).toBe(value)
    if (typeof value === 'function') {
      expect(value()).toBe('prop callback')
    }
  }
  finally {
    definition.lifetimes.detached.call(host)
  }
})
