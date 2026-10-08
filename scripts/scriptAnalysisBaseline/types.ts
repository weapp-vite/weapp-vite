import type { CompileVueFileOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/types'
import type { TransformScriptOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'

export const SCRIPT_VARIANTS = ['baseline', 'control', 'ast-reuse', 'props-no-scope', 'page-meta-gate', 'reserved-props-gate', 'optimized'] as const
export type ScriptVariant = typeof SCRIPT_VARIANTS[number]

interface ScenarioBase {
  id: string
  source: string
  filename: string
  expectError?: boolean
  withoutWarn?: boolean
  expectWarning?: boolean
}

export type ScriptScenario
  = | (ScenarioBase & { kind: 'sfc', options: CompileVueFileOptions })
    | (ScenarioBase & { kind: 'script', options: TransformScriptOptions })
    | (ScenarioBase & { kind: 'reserved-props', start?: { line: number, column: number } })

export interface ScriptCheck {
  scenario: string
  inputSha256: string
  iteration: number
  output: string
  failed: boolean
  warnings: string[]
  metrics: Record<string, unknown>
}

export interface ScriptWorkerReport {
  variant: ScriptVariant
  sourceHashes: Record<string, string>
  checks: ScriptCheck[]
}
