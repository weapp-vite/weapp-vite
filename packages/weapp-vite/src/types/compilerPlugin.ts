import type { OutputBundle } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { OutputExtensions } from '../platforms/types'
import type { MpPlatform } from './config'

export type WeappCompilerPluginPhase = 'source' | 'output'
export type WeappCompilerResourceKind = 'style' | 'template' | 'script'

export interface WeappCompilerPluginCapabilities {
  bundle?: boolean
  style?: boolean
  template?: boolean
  script?: boolean
  content?: boolean
  hmr?: boolean
}

export interface WeappCompilerPluginContext {
  root: string
  srcRoot: string
  platform: MpPlatform
  outputExtensions: OutputExtensions
  isDev: boolean
  resolvedConfig?: ResolvedConfig
  readFile: (id: string) => Promise<string>
  resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
  addWatchFile: (id: string) => void
  invalidate: (id: string) => void
  warn: (message: string) => void
  error: (message: string) => never
  claimSource: (id: string, owner: string) => void
  getSourceOwner: (id: string) => string | undefined
}

export interface WeappCompilerSourceRequest {
  id: string
  code: string
  kind: WeappCompilerResourceKind
}

export interface WeappCompilerTransformResult {
  code: string
  /** 与产物关联的稳定入口标识；未提供时由 host 使用源码 id。 */
  entryId?: string
  map?: unknown
  dependencies?: string[]
  /** provider 需要 host 重新处理的文件集合。 */
  invalidated?: string[]
  handled?: boolean
  state?: unknown
}

export interface WeappCompilerSourceClaim {
  id?: string
  entryId?: string
  dependencies?: string[]
}

export interface WeappCompilerOutputRequest {
  fileName: string
  code: string
  entryId?: string
  state?: unknown
}

export interface WeappCompilerPluginController {
  buildStart?: () => void | Promise<void>
  claimSource?: (request: WeappCompilerSourceRequest) => boolean | WeappCompilerSourceClaim | Promise<boolean | WeappCompilerSourceClaim | null> | null
  transformSource?: (request: WeappCompilerSourceRequest) => WeappCompilerTransformResult | null | Promise<WeappCompilerTransformResult | null>
  generateBundle?: (bundle: OutputBundle, context: WeappCompilerPluginContext) => void | Promise<void>
  transformCss?: (request: WeappCompilerOutputRequest) => WeappCompilerTransformResult | null | Promise<WeappCompilerTransformResult | null>
  transformTemplate?: (request: WeappCompilerOutputRequest) => WeappCompilerTransformResult | null | Promise<WeappCompilerTransformResult | null>
  transformJavaScript?: (request: WeappCompilerOutputRequest) => WeappCompilerTransformResult | null | Promise<WeappCompilerTransformResult | null>
  watchChange?: (id: string, change: { event: 'create' | 'update' | 'delete' }) => void | Promise<void>
  handleHotUpdate?: (file: string) => string[] | void | Promise<string[] | void>
  buildEnd?: (error?: Error) => void | Promise<void>
  closeWatcher?: () => void | Promise<void>
  closeBundle?: () => void | Promise<void>
  dispose?: () => void | Promise<void>
}

export interface WeappCompilerPlugin {
  name: string
  phase?: WeappCompilerPluginPhase
  capabilities?: WeappCompilerPluginCapabilities
  create: (context: WeappCompilerPluginContext) => WeappCompilerPluginController | Promise<WeappCompilerPluginController>
}

export type WeappCompilerPluginFactory = (context: WeappCompilerPluginContext) => WeappCompilerPlugin | Promise<WeappCompilerPlugin>
export type WeappCompilerPluginOption = WeappCompilerPlugin | WeappCompilerPluginFactory
