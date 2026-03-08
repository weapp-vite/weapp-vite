export interface SelectorQueryNodeFields {
  id?: boolean
  dataset?: boolean
  rect?: boolean
  size?: boolean
  scrollOffset?: boolean
  properties?: string[]
  computedStyle?: string[]
  context?: boolean
  node?: boolean
}

export type SelectorQueryNodeCallback = (result: any) => void

export interface SelectorQuery {
  in: (context?: unknown) => SelectorQuery
  select: (selector: string) => SelectorQueryNodesRef
  selectAll: (selector: string) => SelectorQueryNodesRef
  selectViewport: () => SelectorQueryNodesRef
  exec: (callback?: (result: any[]) => void) => SelectorQuery
}

export interface SelectorQueryNodesRef {
  boundingClientRect: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  scrollOffset: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  fields: (fields: SelectorQueryNodeFields, callback?: SelectorQueryNodeCallback) => SelectorQuery
  node: (callback?: SelectorQueryNodeCallback) => SelectorQuery
}

export type SelectorTargetDescriptor
  = | { type: 'node', selector: string, multiple: boolean }
    | { type: 'viewport' }

export type SelectorQueryTask
  = | {
    type: 'boundingClientRect'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'scrollOffset'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'fields'
    target: SelectorTargetDescriptor
    fields: SelectorQueryNodeFields
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'node'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }
