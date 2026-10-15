import type { Ref } from '../src/reactivity'
import { WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { shallowRef } from '../src/reactivity'
import { createWevuComponentDefinition, getWevuComponentLifecycleDefinition } from '../src/runtime/define'
import { inject, provide } from '../src/runtime/provide'

interface MountedHost {
  instance: Record<string, any>
  detach: () => void
}

interface ProvidedValue {
  context: { count: Ref<number> }
  upstream: { label: string }
}

function mount(options: Record<string, any>, owner?: Record<string, any>): MountedHost {
  const definition = getWevuComponentLifecycleDefinition(createWevuComponentDefinition(options))!
  const instance: Record<string, any> = {
    properties: {},
    data: structuredClone(definition.data ?? {}),
    selectOwnerComponent: () => owner,
    triggerEvent() {},
    setData(payload: Record<string, unknown>, callback?: () => void) {
      Object.assign(this.data, payload)
      callback?.()
    },
    ...definition.methods,
  }
  definition.lifetimes.created.call(instance)
  definition.lifetimes.attached.call(instance)
  return { instance, detach: () => definition.lifetimes.detached.call(instance) }
}

describe.each([false, true])('Options API provide with nativeSlotContext=%s', (nativeSlotContext) => {
  it.each(['created', 'attached'])('resolves setup and injected computed dependencies in %s', (setupLifecycle) => {
    const contextKey = Symbol('computed-context')
    const upstreamKey = Symbol('upstream-context')
    const count = shallowRef(2)
    const context = { count }
    const upstream = { label: 'ancestor' }
    const hosts: MountedHost[] = []
    let provided: ProvidedValue | undefined
    let seen: ProvidedValue | undefined
    try {
      const ancestor = mount({ provide: { [upstreamKey]: upstream } })
      hosts.push(ancestor)
      const parent = mount({
        [WEVU_NATIVE_SLOT_CONTEXT_KEY]: nativeSlotContext,
        setupLifecycle,
        inject: { upstream: { from: upstreamKey } },
        setup() {
          provide(contextKey, 'setup-value')
          return { holder: shallowRef(context), readContext: (value: unknown) => value }
        },
        computed: {
          first(this: any) { return this.holder },
          second(this: any) { return this.first.value },
          third(this: any) { return { context: this.readContext(this.second), upstream: this.upstream } },
        },
        provide(this: any) {
          provided = this.third
          return { [contextKey]: provided }
        },
      }, ancestor.instance)
      hosts.push(parent)
      const child = mount({
        setup() {
          seen = inject<ProvidedValue>(contextKey)
        },
      }, parent.instance)
      hosts.push(child)
      expect(seen).toBe(provided)
      expect(seen).toEqual({ context, upstream })
      expect(seen?.context).toBe(context)
      count.value++
      expect(seen?.context.count.value).toBe(3)
    }
    finally {
      for (const host of hosts.reverse()) {
        host.detach()
      }
    }
  })
})
