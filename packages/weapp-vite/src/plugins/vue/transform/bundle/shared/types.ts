import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ReExportResolutionCache } from '../../../../../utils/reExport'
import type { ResolvedAppShell } from '../../appShell'
import type { CompileVueFileResolvedOptions } from '../../compileOptions'
import type { ResolvedPageLayoutPlan } from '../../pageLayout'

export type VueBundleTransformMeta = NonNullable<VueTransformResult['meta']> & {
  pageLayoutPlan?: ResolvedPageLayoutPlan | null
}

export type VueBundleTransformResult = Omit<VueTransformResult, 'meta'> & {
  meta?: VueBundleTransformMeta
}

export function getVueBundlePageLayoutPlan(result: VueTransformResult) {
  return (result as VueBundleTransformResult).meta?.pageLayoutPlan
}

export function setVueBundlePageLayoutPlan(result: VueTransformResult, plan: ResolvedPageLayoutPlan | undefined) {
  const current = result as VueBundleTransformResult
  current.meta = {
    ...current.meta,
    // null 表示已解析且没有布局，避免资产阶段重新分析相同输入。
    pageLayoutPlan: plan ?? null,
  }
}

export interface CompilationCacheEntry {
  result: VueBundleTransformResult
  source?: string
  isPage: boolean
  autoRoutesSignature?: string
  appShellSignature?: string
  refreshToken?: number
  styleIndependentSignature?: string
}

export interface VueBundleState {
  ctx: CompilerContext
  isBundledDev?: boolean
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  /** 当前输出的逻辑注册图；缺失时不从编译缓存推导原生资产所有权。 */
  nativeEntrySources?: ReadonlySet<string>
  /** 仅当前构建代次已由 transform 校验的纯编译结果，不包含 hook 上下文。 */
  validatedCompilations?: WeakSet<VueTransformResult>
  assetContext?: ReturnType<typeof import('./assets')['resolveVueBundleAssetContext']>
  appShell?: ResolvedAppShell
  reExportResolutionCache: ReExportResolutionCache
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
  nativeSlotContextCache?: CompileVueFileResolvedOptions['nativeSlotContextCache']
}

export interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

export interface VueBundleCompileOptionsState {
  reExportResolutionCache: ReExportResolutionCache
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
  nativeSlotContextCache?: CompileVueFileResolvedOptions['nativeSlotContextCache']
  emitResolvedComponentEntries?: boolean
}
