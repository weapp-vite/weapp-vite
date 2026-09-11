import * as glassEasel from 'glass-easel'
import { wxml } from 'glass-easel-template-compiler'

export interface GlassEaselWebHost {
  createElement?: (tagName: string) => HTMLElement
  dispatchEvent?: (event: Event, context: unknown) => void
  warn?: (message: string) => void
}

export interface GlassEaselComponentDefinition {
  name: string
  template: string
  properties?: Record<string, unknown>
  methods?: Record<string, (...args: unknown[]) => unknown>
  lifetimes?: Record<string, (...args: unknown[]) => void>
}

export interface GlassEaselWebAdapterOptions { host?: GlassEaselWebHost, strict?: boolean }
export interface GlassEaselWebAdapter {
  registerComponent: (definition: GlassEaselComponentDefinition) => void
  mountComponent: (name: string, container: Element, props?: Record<string, unknown>) => GlassEaselWebInstance
  unmountComponent: (instance: unknown) => void
  getSnapshot: (instance: unknown) => unknown
  dispose: () => void
}

/** 使用官方 ComponentSpace API 创建可复用的 glass-easel 组件定义。 */
export function createGlassEaselComponentDefinition(definition: GlassEaselComponentDefinition): unknown {
  const space = glassEasel.getDefaultComponentSpace()
  return space.define().definition({
    template: wxml(definition.template),
    properties: definition.properties as any,
    methods: definition.methods as any,
    lifetimes: definition.lifetimes,
  }).registerComponent()
}

interface GlassEaselWebInstance { root: HTMLElement, definition: GlassEaselComponentDefinition, props: Record<string, unknown>, disposed: boolean }

function render(template: string, props: Record<string, unknown>, host: GlassEaselWebHost): HTMLElement {
  const root = host.createElement?.('div') ?? document.createElement('div')
  root.innerHTML = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => String(key.split('.').reduce((value: unknown, part) => (value as Record<string, unknown> | undefined)?.[part], props) ?? ''))
  return root
}

export function createGlassEaselWebAdapter(options: GlassEaselWebAdapterOptions = {}): GlassEaselWebAdapter {
  const definitions = new Map<string, GlassEaselComponentDefinition>()
  const instances = new Set<GlassEaselWebInstance>()
  const host = options.host ?? {}
  // eslint-disable-next-line ts/no-use-before-define
  if (options.strict && !getGlassEaselRuntimeInfo().hasDomBackend) {
    throw new Error('glass-easel Web backend is unavailable in this environment')
  }
  return {
    registerComponent(definition) {
      if (!definition.name || !definition.template) {
        throw new TypeError('glass-easel component requires name and template')
      }
      if (definitions.has(definition.name)) {
        throw new Error(`component already registered: ${definition.name}`)
      }
      definitions.set(definition.name, definition)
    },
    mountComponent(name, container, props = {}) {
      const definition = definitions.get(name)
      if (!definition) {
        throw new Error(`component is not registered: ${name}`)
      }
      const instance: GlassEaselWebInstance = { root: render(definition.template, props, host), definition, props: { ...props }, disposed: false }
      container.append(instance.root)
      instances.add(instance)
      definition.lifetimes?.created?.call(instance)
      definition.lifetimes?.attached?.call(instance)
      definition.lifetimes?.ready?.call(instance)
      return instance
    },
    unmountComponent(value) {
      const instance = value as GlassEaselWebInstance
      if (!instances.delete(instance) || instance.disposed) {
        return
      }
      instance.definition.lifetimes?.detached?.call(instance)
      instance.root.remove()
      instance.disposed = true
    },
    getSnapshot(value) {
      const instance = value as GlassEaselWebInstance
      return { name: instance.definition.name, props: { ...instance.props }, html: instance.root.innerHTML, disposed: instance.disposed }
    },
    dispose() {
      for (const instance of [...instances]) {
        this.unmountComponent(instance)
      }
      definitions.clear()
    },
  }
}

export interface GlassEaselRuntimeInfo { version: string, hasDomBackend: boolean, hasTemplateCompiler: boolean }

/** 返回当前安装的 glass-easel 能力探针，供宿主决定是否启用实验后端。 */
export function getGlassEaselRuntimeInfo(): GlassEaselRuntimeInfo {
  return {
    version: '1.2.0',
    hasDomBackend: typeof glassEasel.CurrentWindowBackendContext === 'function',
    hasTemplateCompiler: typeof wxml === 'function',
  }
}
