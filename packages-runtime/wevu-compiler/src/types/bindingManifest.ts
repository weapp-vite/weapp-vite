import type { SourceSpan } from './diagnostics'

/**
 * 模板绑定的语义类型。
 */
export type WevuBindingKind
  = | 'text'
    | 'attribute'
    | 'class'
    | 'style'
    | 'if'
    | 'for'
    | 'component-prop'

/**
 * 模板绑定可采用的更新粒度。
 */
export type WevuBindingUpdateMode = 'exact-path' | 'top-level' | 'snapshot-fallback'

/**
 * 单个模板输出与其源码依赖之间的稳定映射。
 */
export interface WevuBindingRecordV1 {
  id: string
  kind: WevuBindingKind
  outputPath: string
  sourceRoots: string[]
  sourcePaths?: string[]
  updateMode: WevuBindingUpdateMode
  sourceLocation?: SourceSpan
}

/**
 * 当前模板使用的按需编译能力。
 */
export interface WevuBindingManifestFeaturesV1 {
  inlineEvents?: true
  templateRefs?: true
  scopedSlots?: true
  model?: true
  layout?: true
  functionProps?: true
  jsxIslands?: true
}

/**
 * 由编译器拥有的第一版模板绑定清单。
 */
export interface WevuBindingManifestV1 {
  version: 1
  sourceFile: string
  bindings: WevuBindingRecordV1[]
  features: WevuBindingManifestFeaturesV1
}
