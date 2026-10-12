import type { SourceMap } from 'magic-string'
import type { AcceptedPlugin, ProcessOptions } from 'postcss'
import type { ViteDevServer } from 'vite'
import type { createWebAssetMiddleware } from './assets'
import type { ResolveWebModuleId, WebStylePreprocessOptions } from './types'

export interface WebPluginContext {
  warn?: (message: string) => void
  addWatchFile?: (id: string) => void
  emitFile?: (asset: { type: 'asset', fileName: string, source: Uint8Array }) => void
  resolve?: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
}

type WebTransformResult = { code: string, map: SourceMap | null } | null

type WebPostcssConfig = ProcessOptions & { plugins?: AcceptedPlugin[] }

export interface WebCssConfig {
  postcss?: string | WebPostcssConfig
  preprocessorOptions?: WebStylePreprocessOptions
}

export interface WebUserConfig {
  css?: WebCssConfig
}

export interface WebResolvedConfig extends WebUserConfig {
  root: string
  command: string
  createResolver?: () => ResolveWebModuleId
  optimizeDeps?: {
    exclude?: string[]
    include?: string[]
  }
}

export interface WebHmrContext<Module extends object = object> {
  file: string
  modules?: Module[]
}

export interface WebDevServer {
  middlewares: {
    use: (middleware: ReturnType<typeof createWebAssetMiddleware>) => void
  }
  moduleGraph?: Pick<ViteDevServer['moduleGraph'], 'getModuleById' | 'getModulesByFile' | 'invalidateModule'>
}

export interface WeappWebVitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  config?: (this: WebPluginContext, config: WebUserConfig) => WebUserConfig | void
  configResolved?: (this: WebPluginContext, config: WebResolvedConfig) => void | Promise<void>
  configureServer?: (server: WebDevServer) => void
  buildStart?: (this: WebPluginContext) => void | Promise<void>
  resolveId?: (id: string, importer?: string) => string | null | Promise<string | null>
  load?: (id: string) => string | null | Promise<string | null>
  watchChange?: {
    order: 'post'
    sequential: true
    handler: (this: WebPluginContext, id: string, change: { event: 'create' | 'update' | 'delete' }) => Promise<void>
  }
  handleHotUpdate?: <Module extends object>(this: WebPluginContext, ctx: WebHmrContext<Module>) => Module[] | void | Promise<Module[] | void>
  transform?: (
    this: WebPluginContext,
    code: string,
    id: string,
  ) => WebTransformResult | Promise<WebTransformResult>
}
