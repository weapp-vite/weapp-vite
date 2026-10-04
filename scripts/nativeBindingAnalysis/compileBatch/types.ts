import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { WevuBindingManifestV1, WevuBindingScopeV1 } from '../../../packages-runtime/wevu-compiler/src/types/bindingManifest'
import type { SourceSpan } from '../../../packages-runtime/wevu-compiler/src/types/diagnostics'
import type { BindingNative } from '../replay'
import type { BindingAnalysis, BindingInput } from '../source'

export type CompileBatchMode = 'eager-js' | 'control-js' | 'planned-js' | 'planned-summary' | 'planned-native'

export interface CompileBatchOptions {
  mode: CompileBatchMode
  binding?: BindingNative
  ignoredGlobals?: string[]
}

export interface RecordOptions {
  kind: WevuBindingManifestV1['bindings'][number]['kind']
  expression: string
  outputPath?: string
  sourceFile?: string
  sourceLocation?: SourceSpan
  scopes?: WevuBindingScopeV1[]
  scopeDependencies?: Array<{ expression: string, locals: string[] }>
}

export type RecordBinding = (manifest: WevuBindingManifestV1, options: RecordOptions, context?: TransformContext, additionalLocals?: Iterable<string>) => void
export type NormalizeBinding = (expression: string, context?: TransformContext) => string
export type ProductionCollector = (expression: string, context: unknown) => BindingAnalysis | null

export interface PlannedRecord {
  options: RecordOptions
  context: TransformContext
  additionalLocals: string[]
  inputs: BindingInput[]
}

export interface CompileBatchMetrics {
  inputCount: number
  uniqueInputCount: number
  consumedInputs: number
  unusedPreparedInputs: number
  nativeCalls: number
  fallbackCount: number
  fallbackReasons: string[]
  flushCount: number
  queuedRecords: number
  directRecords: number
  unbatchedCalls: number
  baseJsCalls: number
  abortedTemplates: number
  discardedRecords: number
}

export interface CompileBatchSnapshot extends CompileBatchMetrics {
  pendingRecords: number
  pendingInputs: number
  activeTemplates: number
}
