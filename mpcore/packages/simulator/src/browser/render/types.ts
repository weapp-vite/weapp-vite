import type { HeadlessComponentDefinition } from '../../host'
import type { HeadlessProjectDescriptor } from '../../project/createProjectDescriptor'
import type { HeadlessComponentInstance } from '../../runtime/componentInstance'
import type { BrowserModuleLoader } from '../moduleLoader'
import type { BrowserVirtualFiles } from '../virtualFiles'

export interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface BrowserRenderScope {
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

export interface BrowserComponentRegistryEntry {
  definition: HeadlessComponentDefinition
  filePath: string
  templatePath: string
}

export interface BrowserRenderedPageTree {
  root: DomNodeLike
  wxml: string
}

export interface BrowserRendererContext {
  changedPageKeys: string[]
  componentCache: Map<string, HeadlessComponentInstance>
  componentScopes: Map<string, BrowserRenderScope>
  files: BrowserVirtualFiles
  moduleLoader: BrowserModuleLoader
  project: HeadlessProjectDescriptor
  session: {
    createIntersectionObserver: (scope: any, options?: Record<string, any>) => any
    createMediaQueryObserver: (scope: any) => any
    selectAllComponentsWithin: (scopeId: string, selector: string) => any[]
    selectComponentWithin: (scopeId: string, selector: string) => any
    selectOwnerComponent: (scopeId: string) => any
  }
}
