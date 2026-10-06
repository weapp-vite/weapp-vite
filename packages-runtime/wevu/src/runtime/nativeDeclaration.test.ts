import type { InternalRuntimeState } from './types'
import {
  WEVU_NATIVE_DECLARATION_ADDRESS_PROP,
  WEVU_NATIVE_DECLARATION_EVENT,
  WEVU_NATIVE_DECLARATION_METHOD,
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
  WEVU_NATIVE_SLOT_PARENT_DATASET_KEY,
  WEVU_NATIVE_SLOT_PARENT_EVENT,
  WEVU_NATIVE_SLOT_PARENT_METHOD,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROVIDES_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { onScopeDispose, ref, toRaw } from '../reactivity'
import { createApp } from './app'
import { createWevuComponentDefinition, getWevuComponentLifecycleDefinition } from './define'
import { createScopedSlotOptions } from './define/scopedSlotOptions'
import { installScopedSlots } from './features/scopedSlots'
import { inject, provide } from './provide'
import { refreshRuntimeInstance, teardownRuntimeInstance } from './register/runtimeInstance'

interface NativeHost {
  target: InternalRuntimeState & { properties: Record<string, unknown> }
  definition: Record<string, any>
  listeners: Array<{ host: NativeHost, parent?: string }>
}

function defineNative(options: Parameters<typeof createWevuComponentDefinition>[0] = {}) {
  return getWevuComponentLifecycleDefinition(createWevuComponentDefinition({
    [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true,
    ...options,
  }))!
}

describe('native declaration context lifecycle', () => {
  const hosts: NativeHost[] = []

  function createHost(definition: Record<string, any>, owner?: NativeHost, address?: readonly [string, string]) {
    const properties: Record<string, unknown> = {}
    for (const [key, schema] of Object.entries(definition.properties ?? {})) {
      if (schema && typeof schema === 'object' && 'value' in schema) {
        properties[key] = schema.value
      }
    }
    if (address) {
      properties[WEVU_NATIVE_DECLARATION_ADDRESS_PROP] = address
    }
    const host: NativeHost = {
      definition,
      listeners: owner ? [{ host: owner }] : [],
      target: { properties, setData() {} },
    }
    Object.assign(host.target, {
      selectOwnerComponent: () => owner?.definition.export.call(owner.target),
      triggerEvent(name: string, detail: unknown) {
        if (name === WEVU_NATIVE_DECLARATION_EVENT && owner) {
          owner.definition.methods[WEVU_NATIVE_DECLARATION_METHOD].call(owner.target, { detail })
        }
        if (name === WEVU_NATIVE_SLOT_PARENT_EVENT) {
          for (const listener of host.listeners) {
            listener.host.definition.methods[WEVU_NATIVE_SLOT_PARENT_METHOD].call(listener.host.target, {
              detail,
              currentTarget: { dataset: { [WEVU_NATIVE_SLOT_PARENT_DATASET_KEY]: listener.parent } },
            })
          }
        }
      },
    })
    hosts.push(host)
    definition.lifetimes.created.call(host.target)
    return host
  }

  function attach(host: NativeHost) {
    host.definition.lifetimes.attached.call(host.target)
  }

  afterEach(() => {
    for (const host of hosts.splice(0).reverse()) {
      teardownRuntimeInstance(host.target, { skipHooks: true })
    }
  })

  it('injects the nearest unprojected declaration with exact identity through a filtered native owner', () => {
    const token = Symbol('closed-slot')
    const count = ref(0)
    const context = { count, increment: () => count.value++ }
    const exported = { publicOnly: true }
    const owner = createHost(defineNative({ export: () => exported, setup: () => provide(token, 'owner') }))
    attach(owner)
    const outer = createHost(defineNative({ setup: () => provide(token, 'outer') }), owner, ['outer', ''])
    attach(outer)
    const inner = createHost(defineNative({ setup: () => provide(token, context) }), owner, ['inner', 'outer'])
    attach(inner)
    let injected: typeof context | undefined
    const leaf = createHost(defineNative({
      setup: () => {
        injected = inject(token)
      },
    }), owner, ['leaf', 'inner'])
    expect(injected).toBeUndefined()
    attach(leaf)

    expect(injected).toBe(context)
    expect(injected?.count).toBe(count)
    expect(injected?.increment).toBe(context.increment)
    injected!.increment()
    expect(count.value).toBe(1)
    expect(leaf.target[WEVU_PARENT_INSTANCE_KEY]).toBe(inner.target)
    expect(leaf.target.selectOwnerComponent!()).toEqual(exported)
  })

  it.each([false, true])('chooses the nested forwarded host regardless of composed listener order (reverse: %s)', (reverse) => {
    const token = Symbol('forwarded')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const forwarder = createHost(defineNative({ setup: () => provide(token, 'forwarder') }), owner, ['forwarder', ''])
    attach(forwarder)
    const context = { count: ref(10) }
    const inner = createHost(defineNative({ setup: () => provide(token, context) }), forwarder, ['inner', ''])
    attach(inner)
    let injected: unknown
    const leaf = createHost(defineNative({
      setup: () => {
        injected = inject(token)
      },
    }), owner, ['leaf', 'forwarder'])
    leaf.listeners = [{ host: owner }, { host: forwarder, parent: 'inner' }, { host: forwarder }]
    if (reverse) {
      leaf.listeners.reverse()
    }
    attach(leaf)

    expect(injected).toBe(context)
    expect(leaf.target[WEVU_PARENT_INSTANCE_KEY]).toBe(inner.target)
  })

  it('reindexes observer newValue before user-created descendants without reassigning the existing graph', () => {
    const token = Symbol('reindex')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const context = { count: ref(1) }
    let injected: typeof context | undefined
    const leafDefinition = defineNative({
      setup: () => {
        injected = inject(token)
      },
    })
    const provider = createHost(defineNative({
      setup: () => provide(token, context),
      observers: {
        [WEVU_NATIVE_DECLARATION_ADDRESS_PROP]() {
          attach(createHost(leafDefinition, owner, ['late-leaf', 'renamed']))
        },
      },
    }), owner, ['initial', ''])
    attach(provider)
    const parent = provider.target[WEVU_PARENT_INSTANCE_KEY]
    const provides = provider.target[WEVU_PROVIDES_KEY]
    provider.definition.observers[WEVU_NATIVE_DECLARATION_ADDRESS_PROP].call(provider.target, ['renamed', 'different-parent'])

    expect(provider.target.properties[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]).toEqual(['initial', ''])
    expect(injected).toBe(context)
    expect(provider.target[WEVU_PROVIDES_KEY]).toBe(provides)
    expect(provider.target[WEVU_PARENT_INSTANCE_KEY]).toBe(parent)
    context.count.value++
    expect(injected?.count.value).toBe(2)
  })

  it('retains only metadata before attached and registers the latest observed address', () => {
    const token = Symbol('pending-address')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const provider = createHost(defineNative({ setup: () => provide(token, 'provider') }), owner, ['initial', ''])
    provider.definition.observers[WEVU_NATIVE_DECLARATION_ADDRESS_PROP].call(provider.target, ['latest', ''])
    const seen: unknown[] = []
    const consumer = defineNative({
      setup: () => {
        seen.push(inject(token))
      },
    })
    attach(createHost(consumer, owner, ['before', 'latest']))
    attach(provider)
    attach(createHost(consumer, owner, ['after', 'latest']))

    expect(seen).toEqual(['owner', 'provider'])
  })

  it('does not let an old instance reindex or detach away a live replacement', () => {
    const token = Symbol('replacement')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const old = createHost(defineNative({ setup: () => provide(token, 'old') }), owner, ['provider', ''])
    attach(old)
    const replacement = createHost(defineNative({ setup: () => provide(token, 'replacement') }), owner, ['provider', ''])
    attach(replacement)
    old.definition.observers[WEVU_NATIVE_DECLARATION_ADDRESS_PROP].call(old.target, ['stale', ''])
    old.definition.lifetimes.detached.call(old.target)
    const seen: unknown[] = []
    const consumer = defineNative({
      setup: () => {
        seen.push(inject(token))
      },
    })
    attach(createHost(consumer, owner, ['current-leaf', 'provider']))
    attach(createHost(consumer, owner, ['stale-leaf', 'stale']))

    expect(seen).toEqual(['replacement', 'owner'])
  })

  it('cleans failed setup without deleting a replacement installed during disposal', () => {
    const token = Symbol('failed-setup')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const replacement = createHost(defineNative({ setup: () => provide(token, 'replacement') }), owner, ['provider', ''])
    const failed = createHost(defineNative({
      setup() {
        provide(token, 'failed')
        onScopeDispose(() => {
          attach(replacement)
          throw new Error('disposal error')
        })
        throw new Error('setup error')
      },
    }), owner, ['provider', ''])
    expect(() => attach(failed)).toThrow('setup error')
    failed.definition.lifetimes.detached.call(failed.target)
    let injected: unknown
    attach(createHost(defineNative({
      setup: () => {
        injected = inject(token)
      },
    }), owner, ['leaf', 'provider']))

    expect(injected).toBe('replacement')
  })

  it('preserves existing child addresses through same-owner HMR but invalidates them on actual detach', () => {
    const token = Symbol('owner-hmr')
    const owner = createHost(defineNative({ setup: () => provide(token, 'owner') }))
    attach(owner)
    const context = { count: ref(10) }
    const provider = createHost(defineNative({ setup: () => provide(token, context) }), owner, ['provider', ''])
    attach(provider)
    refreshRuntimeInstance(owner.target, createApp({}), undefined, () => provide(token, 'refreshed-owner'), { attached: true })
    const seen: unknown[] = []
    const consumer = defineNative({
      setup: () => {
        seen.push(inject(token))
      },
    })
    attach(createHost(consumer, owner, ['hmr-leaf', 'provider']))
    const refreshedContext = { count: ref(20) }
    refreshRuntimeInstance(provider.target, createApp({}), undefined, () => provide(token, refreshedContext), { attached: true })
    attach(createHost(consumer, owner, ['provider-hmr-leaf', 'provider']))
    owner.definition.lifetimes.detached.call(owner.target)
    attach(owner)
    attach(createHost(consumer, owner, ['remount-leaf', 'provider']))

    expect(seen).toEqual([context, refreshedContext, 'owner'])
  })

  it('gives a generated scoped template its own native declaration context', () => {
    installScopedSlots()
    const scopedOptions = createScopedSlotOptions({ [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true })
    // 工厂使用动态常量键；该边界与生产 scoped creator 的选项转换一致。
    const componentOptions = scopedOptions as unknown as Parameters<typeof createWevuComponentDefinition>[0]
    const scopedDefinition = getWevuComponentLifecycleDefinition(createWevuComponentDefinition(componentOptions))!
    const owner = createHost(scopedDefinition)
    attach(owner)
    const token = Symbol('scoped-template')
    const context = { count: ref(10) }
    const provider = createHost(defineNative({ setup: () => provide(token, context) }), owner, ['provider', ''])
    attach(provider)
    let injected: unknown
    attach(createHost(defineNative({
      setup: () => {
        injected = inject(token)
      },
    }), owner, ['leaf', 'provider']))

    expect(injected).toBe(context)
  })

  it('supports Options API injection aliases without authored props or setup', () => {
    const token = Symbol('options-alias')
    const context = { count: ref(10) }
    const owner = createHost(defineNative())
    attach(owner)
    const provider = createHost(defineNative({ provide: () => ({ [token]: context }) }), owner, ['provider', ''])
    attach(provider)
    const leaf = createHost(defineNative({ inject: { localContext: { from: token } } }), owner, ['leaf', 'provider'])
    attach(leaf)

    expect(toRaw(leaf.target.__wevu!.proxy.localContext)).toBe(context)
  })
})
