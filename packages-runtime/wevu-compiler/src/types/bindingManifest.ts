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
 * 单个源码依赖及其独立更新策略。
 */
export interface WevuBindingDependencyV1 {
  root: string
  path?: string
  updateMode: WevuBindingUpdateMode
}

/**
 * 模板绑定所在的词法作用域。
 */
export interface WevuBindingScopeV1 {
  kind: 'root' | 'for' | 'slot-owner' | 'slot-props'
  depth: number
  locals?: string[]
}

/**
 * 单个模板输出与其源码依赖之间的稳定映射。
 */
export interface WevuBindingRecordV1 {
  id: string
  kind: WevuBindingKind
  outputPath: string
  sourceRoots: string[]
  sourcePaths?: string[]
  dependencies: WevuBindingDependencyV1[]
  scopes: WevuBindingScopeV1[]
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
 * 由编译器拥有的第一版完整模板绑定 IR。
 */
export interface WevuBindingManifestV1 {
  version: 1
  sourceFile: string
  bindings: WevuBindingRecordV1[]
  features: WevuBindingManifestFeaturesV1
}

/**
 * 注入运行时的 Binding Manifest 精简级别。
 */
export type WevuRuntimeBindingManifestMode = 'compact' | 'diagnostic'

/**
 * 运行时更新和诊断所需的最小绑定记录。
 */
export interface WevuRuntimeBindingRecordV1 {
  id: string
  outputPath: string
  updateMode?: WevuBindingUpdateMode
  sourceRoots?: string[]
  sourceLocation?: SourceSpan
}

/**
 * 注入组件脚本的精简 Binding Manifest。
 */
export interface WevuRuntimeBindingManifestV1 {
  version: 1
  sourceFile: string
  bindings: WevuRuntimeBindingRecordV1[]
  features?: {
    scopedSlots?: true
  }
}
