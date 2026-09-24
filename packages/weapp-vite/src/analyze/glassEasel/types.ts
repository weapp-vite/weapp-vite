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

export interface GlassEaselNativeScriptModule {
  /** DevEngine moduleGraph 中的原始模块 ID。 */
  id: string
  /** DevEngine moduleGraph 中当前完整的模块代码。 */
  code: string
}

export interface GlassEaselNativeScriptUpdate {
  /** 已知产物为 chunk 文件名；尚未映射的模块为真实原始模块 ID。 */
  file: string
  modules: readonly GlassEaselNativeScriptModule[]
  /** 模块尚无实际 chunk 归属，不得将 file 当作构建产物。 */
  sourceOnly?: true
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
