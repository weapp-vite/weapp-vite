import type { HeadlessComponentDefinition } from '../../host'
import type { ArtifactSource } from '../../kernel/artifactSource'
import type { HeadlessProjectDescriptor } from '../../project/createProjectDescriptor'
import type { HeadlessComponentInstance } from '../../runtime/componentInstance'
import type { MiniProgramEventBinding } from '../../view/eventBinding'
import type { TemplateRenderState } from '../../view/templateRuntime'
import type { WxsModuleBindings } from '../../view/wxs'
import type { BrowserModuleLoader } from '../moduleLoader'
import type { BrowserPageStyles } from '../styles'
import type { BrowserVirtualFiles } from '../virtualFiles'

export interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  dataset?: Record<string, unknown>
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface BrowserRenderScope {
  wxs?: WxsModuleBindings
  alias?: string
  classList?: string[]
  data: Record<string, any>
  dataset?: Record<string, unknown>
  eventBindings?: Map<string, MiniProgramEventBinding>
  captureEventBindings?: Map<string, MiniProgramEventBinding>
  getMethod: (methodName: string) => ((...args: any[]) => any) | undefined
  getScopeId: () => string
  genericComponents?: Map<string, string>
  hostId?: string
  hostNode?: DomNodeLike
  listenerScopeId?: string
  id?: string
  ownerScopeId?: string
  slots?: Map<string, BrowserSlotContent[]>
}

export interface BrowserSlotContent {
  instancePath: string
  node: DomNodeLike
  ownerFilePath: string
  ownerJsonPath: string
  scope: BrowserRenderScope
  templateRenderState: TemplateRenderState<DomNodeLike>
}

export interface BrowserComponentRegistryEntry {
  definition: HeadlessComponentDefinition
  filePath: string
  templatePath: string
}

export interface BrowserRenderedPageTree {
  root: DomNodeLike
  styles: BrowserPageStyles
  wxml: string
}

export interface BrowserRendererContext {
  changedPageKeys: string[]
  componentCache: Map<string, HeadlessComponentInstance>
  componentScopes: Map<string, BrowserRenderScope>
  files: BrowserVirtualFiles
  templateSource?: Pick<ArtifactSource, 'readText'>
  moduleLoader: BrowserModuleLoader
  project: HeadlessProjectDescriptor
  /** 小程序模拟设备的视口宽度；不使用宿主浏览器窗口尺寸。 */
  viewportWidth?: number
  session: {
    createIntersectionObserver: (scope: any, options?: Record<string, any>) => any
    createMediaQueryObserver: (scope: any) => any
    requestRender: (callback?: () => void) => void
    selectAllComponentsWithin: (scopeId: string, selector: string) => any[]
    selectComponentWithin: (scopeId: string, selector: string) => any
    selectOwnerComponent: (scopeId: string) => any
  }
}
