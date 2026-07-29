import type { TemplateRenderer } from '../template'

export type DataRecord = Record<string, any>

export interface PropertyOption {
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor | null
  optionalTypes?: Array<StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor>
  value?: any
  observer?: (this: ComponentPublicInstance, newValue: any, oldValue: any) => void
}

export type PropertyDeclaration = PropertyOption
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | null

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

export type RelationType = 'parent' | 'child' | 'ancestor' | 'descendant'

export interface RelationOption {
  type: RelationType
  linked?: (this: ComponentPublicInstance, target: ComponentPublicInstance) => void
  linkChanged?: (this: ComponentPublicInstance, target: ComponentPublicInstance) => void
  unlinked?: (this: ComponentPublicInstance, target: ComponentPublicInstance) => void
}

export interface ComponentBehaviorOptions {
  addGlobalClass?: boolean
  styleIsolation?: 'isolated' | 'apply-shared' | 'shared'
  virtualHost?: boolean
  [key: string]: unknown
}

export interface ComponentOptions {
  properties?: Record<string, PropertyDeclaration>
  data?: DataRecord | (() => DataRecord)
  methods?: Record<string, (this: ComponentPublicInstance, event: any) => any>
  observers?: Record<string, (this: ComponentPublicInstance, ...values: any[]) => void>
  lifetimes?: LifeTimeHooks
  pageLifetimes?: PageLifeTimeHooks
  relations?: Record<string, RelationOption>
  behaviors?: ComponentOptions[]
  options?: ComponentBehaviorOptions
}

export type NormalizedComponentOptions = Omit<ComponentOptions, 'properties'> & {
  properties?: Record<string, PropertyOption>
}

export interface DefineComponentOptions {
  id?: string
  template: TemplateRenderer
  style?: string
  component?: ComponentOptions
  observerInit?: boolean
}

export interface TriggerEventOptions {
  bubbles?: boolean
  composed?: boolean
  capturePhase?: boolean
}

export interface ComponentPublicInstance extends HTMLElement {
  readonly data: DataRecord
  readonly properties: DataRecord
  setData: (patch: DataRecord, callback?: () => void) => void | Promise<void>
  triggerEvent: (name: string, detail?: any, options?: TriggerEventOptions) => void
  createSelectorQuery: () => any
  selectComponent: (selector: string) => ComponentPublicInstance | null
  selectAllComponents: (selector: string) => ComponentPublicInstance[]
  getRelationNodes: (relationPath: string) => ComponentPublicInstance[]
}

export type ComponentConstructor = CustomElementConstructor & {
  __weappUpdate?: (options: DefineComponentOptions) => void
}
