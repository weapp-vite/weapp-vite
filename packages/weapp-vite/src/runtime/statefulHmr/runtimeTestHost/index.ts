import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { vi } from 'vitest'
import { statefulHmrRolldownRuntimeSource } from '../runtimeSource'

export interface HostInstance {
  data: { count: number, input: string }
  properties?: Record<string, unknown>
  setData: (data: HostInstance['data']) => void
}

export type Hook = (this: HostInstance) => void

export interface Definition {
  data?: HostInstance['data']
  properties?: Record<string, unknown>
  onLoad?: Hook
  onUnload?: Hook
  created?: Hook
  attached?: Hook
  increment?: Hook
  lifetimes?: Record<string, Hook>
  methods?: Record<string, Hook>
}

export interface RuntimeBridge {
  installNative: (name: string, callback: (definition: Definition) => Definition) => void
  App: (definition: Definition) => Definition
  Page: (definition: Definition) => Definition
  Component: (definition: Definition) => void
  takeNativeDefinitions: (name: string) => Definition[]
  trackWevuComponent: (definition: Definition, refresh: (instance: HostInstance, snapshot?: HostInstance['data']) => void, dispose?: (instance: HostInstance) => void) => Definition
  beginUpdate: () => void
  endUpdate: () => void
  getDebugSnapshot: () => { instances: { moduleId: string, count: number }[] }
}

export function createRuntime() {
  const timers: (() => void)[] = []
  const context = {
    DevRuntime: class {},
    setTimeout: (callback: () => void) => timers.push(callback),
  }
  const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, context) as {
    __rolldown_runtime__: { currentModuleId: string }
  } & Record<typeof WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, RuntimeBridge>
  const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  globals.__rolldown_runtime__.currentModuleId = 'pages/counter'
  bridge.installNative('Page', definition => definition)
  bridge.installNative('App', definition => definition)
  return {
    bridge,
    finishUpdate() {
      bridge.endUpdate()
      for (const timer of timers.splice(0)) {
        timer()
      }
    },
    instanceCount() {
      return bridge.getDebugSnapshot().instances.find(value => value.moduleId === 'pages/counter')?.count ?? 0
    },
  }
}

export function createHost(): HostInstance {
  const host: HostInstance = {
    data: { count: 0, input: '' },
    setData: vi.fn(data => Object.assign(host.data, data)),
  }
  return host
}
