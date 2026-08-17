import type { RuntimeApp } from 'wevu'
import type { EmittedEventMap, MountOptions, WevuTestWrapper } from './types'

function setDataPath(target: Record<string, any>, path: string, value: unknown) {
  const segments = path.split('.').filter(Boolean)
  if (segments.length < 2) {
    target[path] = value
    return
  }

  let current = target
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[segment] = {}
    }
    current = current[segment]
  }
  current[segments[segments.length - 1]] = value
}

export function applyDataPayload(target: Record<string, any>, payload: Record<string, any>) {
  for (const [path, value] of Object.entries(payload)) {
    setDataPath(target, path, value)
  }
}

export function createEmitted(emissions: EmittedEventMap): WevuTestWrapper['emitted'] {
  return ((eventName?: string) => {
    if (eventName) {
      const entries = emissions[eventName]
      return entries?.map(args => [...args])
    }
    return Object.fromEntries(
      Object.entries(emissions).map(([name, entries]) => [name, entries.map(args => [...args])]),
    ) as EmittedEventMap
  }) as WevuTestWrapper['emitted']
}

export function applyGlobalOptions(runtimeApp: RuntimeApp<any, any, any>, options: Pick<MountOptions, 'global'>) {
  const globalOptions = options.global
  if (!globalOptions) {
    return
  }

  Object.assign(runtimeApp.config.globalProperties, globalOptions.config?.globalProperties)
  Object.assign(runtimeApp.config.globalProperties, globalOptions.mocks)

  if (globalOptions.provide instanceof Map) {
    for (const [key, value] of globalOptions.provide) {
      runtimeApp.provide(key, value)
    }
  }
  else if (globalOptions.provide) {
    for (const key of Reflect.ownKeys(globalOptions.provide)) {
      runtimeApp.provide(key, globalOptions.provide[key as keyof typeof globalOptions.provide])
    }
  }

  for (const pluginEntry of globalOptions.plugins ?? []) {
    if (Array.isArray(pluginEntry)) {
      const [plugin, ...pluginOptions] = pluginEntry
      runtimeApp.use(plugin as any, ...pluginOptions)
    }
    else {
      runtimeApp.use(pluginEntry as any)
    }
  }
}
