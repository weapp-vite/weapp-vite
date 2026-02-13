import type { TemplateRenderer } from '../template'

export type DataRecord = Record<string, any>

export interface PropertyOption {
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor | null
  value?: any
  observer?: (this: ComponentPublicInstance, newValue: any, oldValue: any) => void
}

export interface LifeTimeHooks {
  created?: (this: ComponentPublicInstance) => void
  attached?: (this: ComponentPublicInstance) => void
  ready?: (this: ComponentPublicInstance) => void
  detached?: (this: ComponentPublicInstance) => void
}

export interface PageLifeTimeHooks {
  show?: (this: ComponentPublicInstance) => void
  hide?: (this: ComponentPublicInstance) => void
  resize?: (this: ComponentPublicInstance) => void
}

export interface ComponentOptions {
  properties?: Record<string, PropertyOption>
  data?: DataRecord | (() => DataRecord)
  methods?: Record<string, (this: ComponentPublicInstance, event: any) => any>
  lifetimes?: LifeTimeHooks
  pageLifetimes?: PageLifeTimeHooks
  behaviors?: ComponentOptions[]
}

export interface DefineComponentOptions {
  template: TemplateRenderer
  style?: string
  component?: ComponentOptions
  observerInit?: boolean
}

export interface ComponentPublicInstance extends HTMLElement {
  readonly data: DataRecord
  readonly properties: DataRecord
  setData: (patch: DataRecord) => void
  triggerEvent: (name: string, detail?: any) => void
  createSelectorQuery: () => any
  selectComponent: (selector: string) => ComponentPublicInstance | null
  selectAllComponents: (selector: string) => ComponentPublicInstance[]
}

export type ComponentConstructor = CustomElementConstructor & {
  __weappUpdate?: (options: DefineComponentOptions) => void
}
