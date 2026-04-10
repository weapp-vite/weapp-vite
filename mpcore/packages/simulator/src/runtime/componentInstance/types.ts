import type { HeadlessBehaviorDefinition, HeadlessComponentDefinition, HeadlessWxMediaQueryObserver } from '../../host'

export interface HeadlessComponentInstance extends Record<string, any> {
  __definition__?: HeadlessComponentDefinition
  __lastInteractionEvent__?: Record<string, any>
  __propertySnapshots__?: Record<string, any>
  __ready__?: boolean
  createIntersectionObserver?: (options?: Record<string, any>) => any
  createMediaQueryObserver?: () => HeadlessWxMediaQueryObserver
  data: Record<string, any>
  properties: Record<string, any>
  selectAllComponents?: (selector: string) => any[]
  selectComponent?: (selector: string) => any
  selectOwnerComponent?: () => any
  setData: (patch: Record<string, any>, callback?: () => void) => void
  triggerEvent: (eventName: string, detail?: unknown, options?: Record<string, any>) => void
}

export interface CreateComponentInstanceOptions {
  definition: HeadlessComponentDefinition
  properties?: Record<string, any>
  triggerEvent?: (
    instance: HeadlessComponentInstance,
    eventName: string,
    detail?: unknown,
    options?: Record<string, any>,
  ) => void
}

export type { HeadlessBehaviorDefinition, HeadlessComponentDefinition }
