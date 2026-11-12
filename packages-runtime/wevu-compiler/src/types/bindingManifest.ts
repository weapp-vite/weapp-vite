import type { WevuBindingUpdateMode } from '@weapp-core/constants'
import type { SourceSpan } from './diagnostics'

export type {
  WevuBindingUpdateMode,
  WevuRuntimeBindingManifestV1,
  WevuRuntimeBindingRecordV1,
} from '@weapp-core/constants'

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
  /** 仅在绑定源码归属不同于清单默认文件时记录。 */
  sourceFile?: string
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
