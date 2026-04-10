import type { HeadlessComponentDefinition } from '../../host'
import type { HeadlessProjectDescriptor } from '../../project'
import type { HeadlessComponentInstance } from '../componentInstance'
import type { HeadlessModuleLoader } from '../moduleLoader'

export interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface RuntimeRenderScope {
  alias?: string
  classList?: string[]
  data: Record<string, any>
  dataset?: Record<string, string>
  eventBindings?: Map<string, { method: string, stopAfter: boolean }>
  getMethod: (methodName: string) => ((...args: any[]) => any) | undefined
  getScopeId: () => string
  hostId?: string
  listenerScopeId?: string
  id?: string
  ownerScopeId?: string
}

export interface RuntimeComponentRegistryEntry {
  definition: HeadlessComponentDefinition
  filePath: string
  templatePath: string
}

export interface RuntimeRenderedPageTree {
  root: DomNodeLike
  wxml: string
}

export interface RuntimeRendererContext {
  changedPageKeys: string[]
  componentCache: Map<string, HeadlessComponentInstance>
  componentScopes: Map<string, RuntimeRenderScope>
  moduleLoader: HeadlessModuleLoader
  project: HeadlessProjectDescriptor
  session: {
    createIntersectionObserver: (scope: any, options?: Record<string, any>) => any
    createMediaQueryObserver: (scope: any) => any
    selectAllComponentsWithin: (scopeId: string, selector: string) => any[]
    selectComponentWithin: (scopeId: string, selector: string) => any
    selectOwnerComponent: (scopeId: string) => any
  }
}
