import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompileVueFileResolvedOptions } from '../../compileOptions'
import type { ResolvedPageLayoutPlan } from '../../pageLayout'

export type VueBundleTransformMeta = NonNullable<VueTransformResult['meta']> & {
  pageLayoutPlan?: ResolvedPageLayoutPlan
}

export type VueBundleTransformResult = Omit<VueTransformResult, 'meta'> & {
  meta?: VueBundleTransformMeta
}

export function getVueBundlePageLayoutPlan(result: VueTransformResult) {
  return (result as VueBundleTransformResult).meta?.pageLayoutPlan
}

export function setVueBundlePageLayoutPlan(result: VueTransformResult, plan: ResolvedPageLayoutPlan) {
  const current = result as VueBundleTransformResult
  current.meta = {
    ...current.meta,
    pageLayoutPlan: plan,
  }
}

export interface CompilationCacheEntry {
  result: VueBundleTransformResult
  source?: string
  isPage: boolean
  autoRoutesSignature?: string
  refreshToken?: number
  styleIndependentSignature?: string
}

export interface VueBundleState {
  ctx: CompilerContext
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  appShell?: ResolvedAppShell
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
}

export interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

export interface VueBundleCompileOptionsState {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
}
