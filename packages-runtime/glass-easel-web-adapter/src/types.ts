import type * as glassEasel from 'glass-easel'

type ComponentParams = glassEasel.typeUtils.ComponentParams<
  glassEasel.typeUtils.DataList,
  glassEasel.typeUtils.PropertyList,
  glassEasel.typeUtils.MethodList
>

export interface GlassEaselWebHost {
  createElement?: (tagName: string) => HTMLElement
  dispatchEvent?: (event: Event, context: unknown) => void
  warn?: (message: string) => void
}

export interface GlassEaselComponentDefinition {
  name: string
  template: string
  data?: ComponentParams['data']
  properties?: ComponentParams['properties']
  methods?: ComponentParams['methods'] & ThisType<glassEasel.GeneralComponent>
  lifetimes?: ComponentParams['lifetimes'] & ThisType<glassEasel.GeneralComponent>
  observers?: ComponentParams['observers'] & ThisType<glassEasel.GeneralComponent>
  usingComponents?: Record<string, string>
  options?: glassEasel.ComponentOptions
}

export interface GlassEaselWebAdapterOptions {
  host?: GlassEaselWebHost
  /** 保留旧调用兼容；所有模式都要求官方 DOM backend，不再使用字符串降级渲染。 */
  strict?: boolean
}

export interface GlassEaselWebSnapshot {
  name: string
  props: Record<string, unknown>
  html: string
  lifecycle: string[]
  disposed: boolean
}

declare const instanceBrand: unique symbol

export interface GlassEaselWebInstance {
  readonly [instanceBrand]: true
  readonly root: HTMLElement
  readonly definition: GlassEaselComponentDefinition
  readonly props: Readonly<Record<string, unknown>>
  readonly disposed: boolean
  readonly native: glassEasel.GeneralComponent
}

export interface GlassEaselWebAdapter {
  registerComponent: (definition: GlassEaselComponentDefinition) => void
  mountComponent: (name: string, container: Element, props?: Record<string, unknown>, slots?: Record<string, string>) => GlassEaselWebInstance
  updateComponent: (instance: GlassEaselWebInstance, props: Record<string, unknown>) => void
  triggerEvent: (instance: GlassEaselWebInstance, name: string, detail?: unknown) => void
  unmountComponent: (instance: GlassEaselWebInstance) => void
  getSnapshot: (instance: GlassEaselWebInstance) => GlassEaselWebSnapshot
  dispose: () => void
}

export interface GlassEaselRuntimeInfo {
  version: string
  hasDomBackend: boolean
  hasTemplateCompiler: boolean
}
