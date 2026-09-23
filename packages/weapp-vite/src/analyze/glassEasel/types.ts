export type GlassEaselDiagnosticCode
  = | 'GE001'
    | 'GE002'
    | 'GE003'
    | 'GE004'
    | 'GE005'
    | 'GE006'

export type GlassEaselDiagnosticSeverity = 'error' | 'warning'

export interface GlassEaselDiagnostic {
  code: GlassEaselDiagnosticCode
  severity: GlassEaselDiagnosticSeverity
  message: string
  file: string
  line?: number
  column?: number
  normalized?: boolean
}

/** 每个 source/output owner 的最近分析事实；日志去重状态不属于当前事实。 */
export interface GlassEaselAnalysisFact {
  kind: 'output' | 'source'
  scope?: string
  detected: boolean
  diagnostics: Map<string, GlassEaselDiagnostic>
  sourceIds: Set<string>
}

export interface AnalyzeGlassEaselBundleOptions {
  /** full 只撤销同一 outputScope 中本轮未出现的产物，partial 仅替换本轮覆盖的产物。 */
  mode: 'full' | 'partial'
  outputScope: string
}

export interface GlassEaselAnalyzeResult {
  detected: boolean
  minimumBaseLibrary: '3.8.12'
  migrationGuide: string
  diagnostics: GlassEaselDiagnostic[]
  summary: {
    errors: number
    warnings: number
  }
}

export interface GlassEaselTemplateFinding {
  code: Extract<GlassEaselDiagnosticCode, 'GE002' | 'GE003' | 'GE004'>
  severity: GlassEaselDiagnosticSeverity
  message: string
  start: number
  normalized?: boolean
}
