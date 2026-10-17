import type { Ref } from '../src/reactivity'
import { WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { shallowRef, toRaw } from '../src/reactivity'
import { createWevuComponentDefinition, getWevuComponentLifecycleDefinition } from '../src/runtime/define'
import { inject, provide } from '../src/runtime/provide'
import { nextTick } from '../src/scheduler'

interface MountedHost {
  instance: Record<string, any>
  detach: () => void
}

interface ProvidedValue {
  context: { count: Ref<number> }
  upstream: { label: string }
  handler: (value: unknown) => unknown
  count: Ref<number>
  value: number
}

interface ProviderProxy {
  holder: Ref<ProvidedValue['context']>
  first: Ref<ProvidedValue['context']>
  second: ProvidedValue['context']
  third: ProvidedValue
  upstream: ProvidedValue['upstream']
  readContext: ProvidedValue['handler']
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
  describe.each(['none', 'ordinary', 'immediate', 'setup-handler'])('with %s watch', (watchMode) => {
    it.each(['created', 'attached'])('resolves setup and injected computed dependencies in %s', async (setupLifecycle) => {
      const contextKey = Symbol('computed-context')
      const upstreamKey = Symbol('upstream-context')
      const count = shallowRef(2)
      const context = { count }
      const upstream = { label: 'ancestor' }
      const hosts: MountedHost[] = []
      const watchCalls: { value: ProvidedValue, oldValue: ProvidedValue | undefined, current: ProvidedValue }[] = []
      let computedCalls = 0
      let provided: ProvidedValue | undefined
      let seen: ProvidedValue | undefined
      function onThird(this: ProviderProxy, value: ProvidedValue, oldValue: ProvidedValue | undefined) {
        watchCalls.push({ value, oldValue, current: this.third })
      }
      const watch = watchMode === 'none'
        ? undefined
        : { third: watchMode === 'setup-handler' ? 'onThird' : watchMode === 'immediate' ? { handler: onThird, immediate: true } : onThird }
      try {
        const ancestor = mount({ provide: { [upstreamKey]: upstream } })
        hosts.push(ancestor)
        const parent = mount({
          [WEVU_NATIVE_SLOT_CONTEXT_KEY]: nativeSlotContext,
          setupLifecycle,
          inject: { upstream: { from: upstreamKey } },
          setup() {
            provide(contextKey, 'setup-value')
            return { holder: shallowRef(context), readContext: (value: unknown) => value, onThird }
          },
          computed: {
            first(this: ProviderProxy) { return this.holder },
            second(this: ProviderProxy) { return this.first.value },
            third(this: ProviderProxy) {
              computedCalls++
              return {
                context: this.readContext(this.second),
                upstream: this.upstream,
                handler: this.readContext,
                count: shallowRef(0),
                value: this.second.count.value,
              }
            },
          },
          watch,
          provide(this: ProviderProxy) {
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
        const proxy = parent.instance.__wevu.proxy
        expect(seen).toBe(provided)
        expect(seen).toBe(proxy.third)
        expect(seen?.context).toBe(context)
        expect(seen?.upstream).toBe(proxy.upstream)
        expect(toRaw(seen?.upstream)).toBe(upstream)
        expect(seen?.handler).toBe(proxy.readContext)
        expect(seen?.handler(context)).toBe(context)
        expect(seen?.count).toBe(proxy.third.count)
        expect(seen?.value).toBe(2)
        expect(computedCalls).toBe(1)
        seen!.count.value++
        await nextTick()
        expect(proxy.third).toBe(provided)
        expect(proxy.third.count.value).toBe(1)
        expect(computedCalls).toBe(1)
        const initialWatchCalls = watchMode === 'immediate' ? 1 : 0
        expect(watchCalls).toHaveLength(initialWatchCalls)
        if (watchMode === 'immediate') {
          expect(watchCalls[0]).toEqual({ value: provided, oldValue: undefined, current: provided })
        }
        count.value++
        await nextTick()
        expect(seen?.context.count.value).toBe(3)
        expect(proxy.third.value).toBe(3)
        expect(proxy.third).not.toBe(provided)
        expect(computedCalls).toBe(2)
        expect(watchCalls).toHaveLength(initialWatchCalls + (watchMode === 'none' ? 0 : 1))
        if (watchMode !== 'none') {
          const lastCall = watchCalls[watchCalls.length - 1]!
          expect(lastCall.value).toBe(proxy.third)
          expect(lastCall.oldValue).toBe(provided)
          expect(lastCall.current).toBe(proxy.third)
        }
        await nextTick()
        expect(computedCalls).toBe(2)
        expect(watchCalls).toHaveLength(initialWatchCalls + (watchMode === 'none' ? 0 : 1))
      }
      finally {
        for (const host of hosts.reverse()) {
          host.detach()
        }
      }
    })
  })
})
