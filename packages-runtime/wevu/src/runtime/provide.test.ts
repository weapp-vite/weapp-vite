import type { InternalRuntimeState, RuntimeApp } from './types'
import {
  WEVU_IS_APP_INSTANCE_KEY,
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
  WEVU_NATIVE_SLOT_PARENT_METHOD,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROVIDES_KEY,
  WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD,
  WEVU_RUNTIME_APP_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onScopeDispose, ref } from '../reactivity'
import { createApp } from './app'
import { setCurrentInstance } from './hooks'
import {
  inject,
  injectGlobal,
  provide,
} from './provide'
import {
  attachRuntimeLayoutProvideContext,
  attachRuntimeProvideContext,
  setRuntimeAppProvidedValue,
} from './provideContext'
import { mountRuntimeInstance, registerComponent, teardownRuntimeInstance } from './register'
import { refreshRuntimeInstance } from './register/runtimeInstance'

function createRuntimeApp() {
  return {} as RuntimeApp<Record<string, never>, Record<string, never>, Record<string, never>>
}

function createRuntimeState(parent: InternalRuntimeState | undefined, runtimeApp: RuntimeApp<any, any, any>) {
  const instance = {} as InternalRuntimeState
  attachRuntimeProvideContext(instance, runtimeApp, parent)
  return instance
}

function runWithInstance<T>(instance: InternalRuntimeState, fn: () => T): T {
  setCurrentInstance(instance)
  try {
    return fn()
  }
  finally {
    setCurrentInstance(undefined)
  }
}

describe('runtime provide/inject', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
  })

  it('resolves app, layout, page and component provides through deep parent chain', () => {
    const runtimeApp = createRuntimeApp()
    const symbolKey = Symbol('symbol-provide')

    setRuntimeAppProvidedValue(runtimeApp, 'app:instance', 'app-instance-value')

    const appInstance = {
      [WEVU_IS_APP_INSTANCE_KEY]: true,
    } as InternalRuntimeState
    attachRuntimeProvideContext(appInstance, runtimeApp)
    runWithInstance(appInstance, () => {
      provide('app:setup', 'app-setup-value')
    })

    const layout = createRuntimeState(undefined, runtimeApp)
    runWithInstance(layout, () => {
      provide('layout', 'layout-value')
    })

    const page = createRuntimeState(layout, runtimeApp)
    runWithInstance(page, () => {
      provide('page', 'page-value')
      provide('shadow', 'page-shadow')
      provide(symbolKey, 'symbol-value')
    })

    let parent = page
    for (let index = 1; index <= 10; index += 1) {
      const child = createRuntimeState(parent, runtimeApp)
      if (index === 1) {
        runWithInstance(child, () => {
          provide('component', 'component-value')
          provide('shadow', 'component-shadow')
        })
      }
      parent = child
    }

    runWithInstance(parent, () => {
      expect(inject('app:instance')).toBe('app-instance-value')
      expect(inject('app:setup')).toBe('app-setup-value')
      expect(inject('layout')).toBe('layout-value')
      expect(inject('page')).toBe('page-value')
      expect(inject('component')).toBe('component-value')
      expect(inject('shadow')).toBe('component-shadow')
      expect(inject(symbolKey)).toBe('symbol-value')
      expect(inject('missing', 'fallback')).toBe('fallback')
    })
  })

  it('inserts layout provides above an already-mounted page scope', () => {
    const runtimeApp = createRuntimeApp()
    setRuntimeAppProvidedValue(runtimeApp, 'app', 'app-value')

    const page = createRuntimeState(undefined, runtimeApp)
    runWithInstance(page, () => {
      provide('page', 'page-value')
    })

    const layout = createRuntimeState(undefined, runtimeApp)
    attachRuntimeLayoutProvideContext(layout, page)
    runWithInstance(layout, () => {
      provide('layout', 'layout-value')
    })

    const child = createRuntimeState(page, runtimeApp)
    runWithInstance(child, () => {
      expect(inject('app')).toBe('app-value')
      expect(inject('layout')).toBe('layout-value')
      expect(inject('page')).toBe('page-value')
    })
  })

  it('keeps component-scoped app provides out of the global fallback store', () => {
    const runtimeApp = createRuntimeApp()
    const token = Symbol('component-scoped-provide')
    setRuntimeAppProvidedValue(runtimeApp, token, 'local-value', { syncGlobal: false })

    const component = createRuntimeState(undefined, runtimeApp)
    runWithInstance(component, () => {
      expect(inject(token)).toBe('local-value')
    })
    expect(injectGlobal(token, 'missing')).toBe('missing')
  })
})

describe('runtime native slot provide/inject', () => {
  const targets: InternalRuntimeState[] = []

  function createHost() {
    const target: InternalRuntimeState = { setData() {} }
    targets.push(target)
    return target
  }

  afterEach(() => {
    for (const target of targets.splice(0)) {
      teardownRuntimeInstance(target)
    }
    vi.unstubAllGlobals()
  })

  it('prefers the nearest live slot host by identity before setup without changing native ownership', () => {
    const app = createApp({})
    const token = Symbol('slot-context')
    const count = ref(0)
    const context = { count, increment: () => count.value++ }
    const owner = createHost()
    const outer = createHost()
    const nearest = createHost()
    const detached = createHost()
    mountRuntimeInstance(owner, app, undefined, () => provide(token, { source: 'owner' }))
    mountRuntimeInstance(outer, app, undefined, () => provide(token, { source: 'outer' }))
    mountRuntimeInstance(nearest, app, undefined, () => provide(token, context))
    mountRuntimeInstance(detached, app, undefined, () => provide(token, { source: 'detached' }))
    teardownRuntimeInstance(detached)

    const exportedOwner = { visible: 'native-export' }
    let injected: typeof context | undefined
    const definition = registerComponent(app, {}, undefined, () => {
      injected = inject(token)
    }, { [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true }, { registerNative: false })
    const child = createHost()
    const selectOwnerComponent = () => owner
    Object.assign(child, {
      selectOwnerComponent,
      triggerEvent(_name: string, detail: unknown) {
        for (const host of [child, exportedOwner, detached, nearest, outer, owner]) {
          definition.methods[WEVU_NATIVE_SLOT_PARENT_METHOD].call(host, { detail })
        }
      },
    })
    definition.lifetimes.created.call(child)
    definition.lifetimes.attached.call(child)

    expect(injected).toBe(context)
    expect(injected?.count).toBe(count)
    expect(injected?.increment).toBe(context.increment)
    injected!.increment()
    expect(count.value).toBe(1)
    expect(child[WEVU_PARENT_INSTANCE_KEY]).toBe(nearest)
    expect(child.selectOwnerComponent).toBe(selectOwnerComponent)
    expect(child.selectOwnerComponent!()).toBe(owner)
  })

  it.each(['owner-first', 'outer-first'])('keeps a filtered template owner regardless of listener order: %s', (order) => {
    const app = createApp({})
    const token = Symbol('nested-template-context')
    const outer = createHost()
    mountRuntimeInstance(outer, app, undefined, () => provide(token, { count: ref(100) }))
    const owner = createHost()
    owner.selectOwnerComponent = () => outer
    const context = { count: ref(200), increment: () => context.count.value++ }
    mountRuntimeInstance(owner, app, undefined, () => provide(token, context))
    let injected: typeof context | undefined
    const definition = registerComponent(app, {}, undefined, () => {
      injected = inject(token)
    }, { [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true }, { registerNative: false })
    const child = createHost()
    const exportedOwner = { label: 'public-owner' }
    Object.assign(child, {
      selectOwnerComponent: () => exportedOwner,
      triggerEvent(_name: string, detail: unknown) {
        for (const host of order === 'owner-first' ? [owner, outer] : [outer, owner]) {
          definition.methods[WEVU_NATIVE_SLOT_PARENT_METHOD].call(host, { detail })
        }
      },
    })
    definition.lifetimes.created.call(child)
    definition.lifetimes.attached.call(child)

    expect(injected).toBe(context)
    injected!.increment()
    expect(context.count.value).toBe(201)
    expect(child[WEVU_PARENT_INSTANCE_KEY]).toBe(owner)
    expect(child.selectOwnerComponent!()).toBe(exportedOwner)
    expect(runWithInstance(outer, () => inject<{ count: { value: number } }>(token))?.count.value).toBe(100)
  })

  it.each(['unmarked', 'disabled', 'created', 'early-public'] as const)(
    'preserves owner context and setup timing for %s mounts',
    (mode) => {
      const app = createApp({})
      const token = Symbol('owner-context')
      const context = { source: 'native-owner' }
      const owner = createHost()
      mountRuntimeInstance(owner, app, undefined, () => provide(token, context))
      const seen: unknown[] = []
      const definition = registerComponent(app, {}, undefined, () => {
        seen.push(inject(token))
      }, {
        [WEVU_NATIVE_SLOT_CONTEXT_KEY]: mode === 'unmarked' ? undefined : mode !== 'disabled',
        setupLifecycle: mode === 'created' ? 'created' : 'attached',
      }, { registerNative: false })
      const child = createHost()
      Object.assign(child, {
        selectOwnerComponent: () => owner,
        triggerEvent() {
          throw new Error('Native slot discovery must not run in this phase or mode')
        },
      })
      definition.lifetimes.created.call(child)
      if (mode === 'early-public') {
        definition.methods[WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD].call(child)
      }
      expect(seen).toEqual(mode === 'created' || mode === 'early-public' ? [context] : [])
      definition.lifetimes.attached.call(child)
      expect(seen).toEqual([context])
    },
  )

  it('re-resolves a recovered attached instance and falls back to page, layout and app context without a live host', () => {
    const app = createApp({})
    setRuntimeAppProvidedValue(app, 'app', 'app-value', { syncGlobal: false })
    const page = createHost()
    mountRuntimeInstance(page, app, undefined, () => provide('page', 'page-value'))
    vi.stubGlobal('getCurrentPages', () => [page])
    const layout = createHost()
    Object.assign(layout, { is: 'layouts/default' })
    mountRuntimeInstance(layout, app, undefined, () => provide('layout', 'layout-value'))
    const host = createHost()
    mountRuntimeInstance(host, app, undefined, () => provide('page', 'slot-value'))
    const seen: unknown[][] = []
    const definition = registerComponent(app, {}, undefined, () => {
      seen.push([inject('page'), inject('layout'), inject('app')])
    }, { [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true }, { registerNative: false })
    const child = createHost()
    Object.assign(child, {
      selectOwnerComponent: () => ({ filtered: true }),
      triggerEvent(_name: string, detail: unknown) {
        definition.methods[WEVU_NATIVE_SLOT_PARENT_METHOD].call(host, { detail })
      },
    })
    definition.lifetimes.created.call(child)
    definition.lifetimes.attached.call(child)
    expect(seen).toEqual([['slot-value', 'layout-value', 'app-value']])

    teardownRuntimeInstance(host)
    teardownRuntimeInstance(child, { skipHooks: true })
    definition.methods[WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD].call(child)
    expect(seen).toEqual([
      ['slot-value', 'layout-value', 'app-value'],
      ['page-value', 'layout-value', 'app-value'],
    ])
    expect(child[WEVU_PARENT_INSTANCE_KEY]).toBe(page)
  })

  it.each([false, true])('retains only a live layout parent across page HMR (detached: %s)', (detached) => {
    const app = createApp({})
    const token = Symbol('layout-hmr')
    const context = { count: ref(0) }
    const page = createHost()
    mountRuntimeInstance(page, app, undefined)
    vi.stubGlobal('getCurrentPages', () => [page])
    const layout = createHost()
    Object.assign(layout, { is: 'layouts/default' })
    mountRuntimeInstance(layout, app, undefined, () => provide(token, context))
    if (detached) {
      teardownRuntimeInstance(layout)
    }

    let injected: unknown
    refreshRuntimeInstance(page, app, undefined, () => {
      injected = inject(token, 'missing')
    })
    expect(injected).toBe(detached ? 'missing' : context)
    expect(page[WEVU_PARENT_INSTANCE_KEY]).toBe(detached ? undefined : layout)
  })

  it('clears failed setup context despite disposal errors and remounts without revoking held values', () => {
    const app = createApp({})
    const token = Symbol('remount-context')
    const oldContext = { count: ref(0) }
    const nextContext = { count: ref(10) }
    const oldHost = createHost()
    const nextHost = createHost()
    mountRuntimeInstance(oldHost, app, undefined, () => provide(token, oldContext))
    mountRuntimeInstance(nextHost, app, undefined, () => provide(token, nextContext))
    const child = createHost()
    let parent = oldHost
    Object.assign(child, { selectOwnerComponent: () => parent })
    let held: typeof oldContext | undefined
    const failure = new Error('setup failure')
    expect(() => mountRuntimeInstance(child, app, undefined, () => {
      held = inject(token)
      onScopeDispose(() => {
        throw new Error('cleanup failure')
      })
      throw failure
    })).toThrow(failure)
    expect(child[WEVU_PARENT_INSTANCE_KEY]).toBeUndefined()
    expect(child[WEVU_PROVIDES_KEY]).toBeUndefined()
    expect(child[WEVU_RUNTIME_APP_KEY]).toBeUndefined()
    expect(held).toBe(oldContext)
    held!.count.value++
    expect(oldContext.count.value).toBe(1)

    parent = nextHost
    let remounted: typeof nextContext | undefined
    mountRuntimeInstance(child, app, undefined, () => {
      remounted = inject(token)
    })
    expect(remounted).toBe(nextContext)
    expect(child[WEVU_PARENT_INSTANCE_KEY]).toBe(nextHost)
  })
})
