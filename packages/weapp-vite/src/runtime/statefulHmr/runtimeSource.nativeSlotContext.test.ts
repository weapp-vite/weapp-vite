import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_DECLARATION_METHOD } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

interface Host {
  data: { count: number }
  setData: (data: Partial<Host['data']>) => void
}

interface Definition {
  properties: Record<string, unknown>
  methods: Record<string, (this: Host) => void>
  lifetimes: { attached: (this: Host) => void }
}

interface Bridge {
  Component: (definition: Definition) => void
  takeNativeDefinitions: (name: string) => Definition[]
  trackWevuComponent: (definition: Definition, refresh: (host: Host) => void) => Definition
  beginUpdate: () => void
  endUpdate: () => void
}

function createRuntime(enabled: boolean) {
  const timers: Array<() => void> = []
  const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, {
    DevRuntime: class {},
    setTimeout: (callback: () => void) => timers.push(callback),
  }) as { __rolldown_runtime__: { currentModuleId: string } } & Record<typeof WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, Bridge>
  globals.__rolldown_runtime__.currentModuleId = 'components/consumer'
  const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  const definition = (participates: boolean, step: number): Definition => ({
    properties: participates ? { [WEVU_NATIVE_DECLARATION_ADDRESS_PROP]: Array } : {},
    methods: {
      increment() { this.setData({ count: this.data.count + step }) },
      ...(participates ? { [WEVU_NATIVE_DECLARATION_METHOD]() {} } : {}),
    },
    lifetimes: { attached() {} },
  })
  const initial = bridge.trackWevuComponent(definition(enabled, 1), () => {})
  bridge.Component(initial)
  const [native] = bridge.takeNativeDefinitions('Component')
  const host: Host = {
    data: { count: 0 },
    setData(data) { Object.assign(this.data, data) },
  }
  native!.lifetimes.attached.call(host)
  let refreshes = 0
  return {
    host,
    update(next: boolean) {
      bridge.beginUpdate()
      try {
        bridge.trackWevuComponent(definition(next, 10), () => {
          refreshes++
        })
      }
      finally {
        bridge.endUpdate()
        for (const timer of timers.splice(0)) {
          timer()
        }
      }
    },
    increment() { native!.methods.increment!.call(host) },
    refreshCount: () => refreshes,
  }
}

describe('stateful HMR native slot registration compatibility', () => {
  it.each([false, true])('requires native re-registration when participation changes from %s', (enabled) => {
    const runtime = createRuntime(enabled)
    expect(() => runtime.update(!enabled)).toThrow()
    expect(runtime.refreshCount()).toBe(0)
    runtime.increment()
    expect(runtime.host.data.count).toBe(1)
  })

  it.each([false, true])('preserves live updates when participation stays %s', (enabled) => {
    const runtime = createRuntime(enabled)
    runtime.update(enabled)
    expect(runtime.refreshCount()).toBe(1)
    runtime.increment()
    expect(runtime.host.data.count).toBe(10)
  })
})
