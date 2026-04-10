import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'

export interface CompilationCacheEntry {
  result: VueTransformResult
  source?: string
  isPage: boolean
}

export interface VueBundleState {
  ctx: CompilerContext
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
}

export interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

export interface VueBundleCompileOptionsState {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
}
