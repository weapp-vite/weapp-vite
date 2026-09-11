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
export interface GlassEaselWebSnapshot {
  name: string
  props: Record<string, unknown>
  html: string
  lifecycle: string[]
  disposed: boolean
}
export interface GlassEaselWebAdapter {
  registerComponent: (definition: GlassEaselComponentDefinition) => void
  mountComponent: (name: string, container: Element, props?: Record<string, unknown>) => GlassEaselWebInstance
  updateComponent: (instance: unknown, props: Record<string, unknown>) => void
  triggerEvent: (instance: unknown, name: string, detail?: unknown) => void
  unmountComponent: (instance: unknown) => void
  getSnapshot: (instance: unknown) => GlassEaselWebSnapshot
  dispose: () => void
}

/** 使用官方 ComponentSpace API 创建可复用的 glass-easel 组件定义。 */
export function createGlassEaselComponentDefinition(definition: GlassEaselComponentDefinition): unknown {
  const space = glassEasel.getDefaultComponentSpace()
  const params: Record<string, unknown> = { template: wxml(definition.template) }
  if (definition.properties) {
    params.properties = definition.properties
  }
  if (definition.methods) {
    params.methods = definition.methods
  }
  if (definition.lifetimes) {
    params.lifetimes = definition.lifetimes
  }
  return space.define().definition(params as any).registerComponent()
}

export interface GlassEaselWebInstance {
  root: HTMLElement
  definition: GlassEaselComponentDefinition
  props: Record<string, unknown>
  disposed: boolean
  native?: any
  backendContext?: any
  lifecycle: string[]
}

function render(template: string, props: Record<string, unknown>, host: GlassEaselWebHost): HTMLElement {
  const root = host.createElement?.('div') ?? document.createElement('div')
  root.innerHTML = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => String(key.split('.').reduce((value: unknown, part) => (value as Record<string, unknown> | undefined)?.[part], props) ?? ''))
  return root
}

export function createGlassEaselWebAdapter(options: GlassEaselWebAdapterOptions = {}): GlassEaselWebAdapter {
  const definitions = new Map<string, GlassEaselComponentDefinition & { native?: any }>()
  const instances = new Set<GlassEaselWebInstance>()
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
      definitions.set(definition.name, { ...definition, native: createGlassEaselComponentDefinition(definition) })
    },
    mountComponent(name, container, props = {}) {
      const definition = definitions.get(name)
      if (!definition) {
        throw new Error(`component is not registered: ${name}`)
      }
      let root: HTMLElement
      let native: any
      let backendContext: any
      // eslint-disable-next-line ts/no-use-before-define
      if (definition.native && getGlassEaselRuntimeInfo().hasDomBackend) {
        const placeholder = document.createElement('glass-easel-placeholder')
        container.append(placeholder)
        backendContext = new glassEasel.CurrentWindowBackendContext()
        backendContext.onEvent(glassEasel.Event.triggerBackendEvent)
        native = glassEasel.Component.createWithContext(name, definition.native, backendContext, (component: any) => {
          component.setData(props)
        })
        glassEasel.Element.replaceDocumentElement(native, placeholder.parentNode as any, placeholder as any)
        root = container.firstElementChild as HTMLElement
      }
      else {
        root = render(definition.template, props, options.host ?? {})
        container.append(root)
      }
      const instance: GlassEaselWebInstance = { root, definition, props: { ...props }, disposed: false, native, backendContext, lifecycle: [] }
      for (const name of ['created', 'attached', 'ready', 'detached']) {
        instance.native?.addLifetimeListener?.(name, () => instance.lifecycle.push(name))
      }
      instances.add(instance)
      return instance
    },
    updateComponent(value, props) {
      const instance = value as GlassEaselWebInstance
      if (instance.disposed) {
        throw new Error('cannot update a disposed glass-easel component')
      }
      instance.props = { ...instance.props, ...props }
      if (instance.native) {
        instance.native.setData(props)
      }
      else {
        const replacement = render(instance.definition.template, instance.props, options.host ?? {})
        instance.root.replaceWith(replacement)
        instance.root = replacement
      }
    },
    triggerEvent(value, name, detail) {
      const instance = value as GlassEaselWebInstance
      if (instance.disposed) {
        throw new Error('cannot trigger an event on a disposed glass-easel component')
      }
      if (instance.native) {
        instance.native.triggerEvent(name, detail)
      }
      options.host?.dispatchEvent?.(new CustomEvent(name, { detail }), instance)
    },
    unmountComponent(value) {
      const instance = value as GlassEaselWebInstance
      if (!instances.delete(instance) || instance.disposed) {
        return
      }
      instance.native?.triggerLifetime?.('detached')
      if (!instance.native) {
        instance.lifecycle.push('detached')
      }
      instance.root?.remove()
      instance.disposed = true
    },
    getSnapshot(value): GlassEaselWebSnapshot {
      const instance = value as GlassEaselWebInstance
      return { name: instance.definition.name, props: { ...instance.props }, html: instance.root.innerHTML, lifecycle: [...instance.lifecycle], disposed: instance.disposed }
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
