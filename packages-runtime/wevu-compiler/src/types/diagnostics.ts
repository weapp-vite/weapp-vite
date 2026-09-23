export type CompilerDiagnosticCode
  = | 'WV1002'
    | 'WV1003'
    | 'WV2003'
    | 'WV2002'
    | 'WV2001'
    | 'WV1001'
export type CompilerDiagnosticSeverity = 'error' | 'warning'
export type CompilerDiagnosticSource = 'expression' | 'jsx' | 'script' | 'sfc' | 'style' | 'template'

/**
 * 编译源码中的位置。行号和列号均从 1 开始，偏移量从 0 开始。
 */
export interface SourcePosition {
  offset: number
  line: number
  column: number
}

/**
 * 编译源码中的半开区间，结束位置不包含在范围内。
 */
export interface SourceSpan {
  start: SourcePosition
  end: SourcePosition
}

/**
 * 可供构建工具和编辑器稳定消费的编译诊断。
 */
export interface CompilerDiagnostic {
  code: CompilerDiagnosticCode
  severity: CompilerDiagnosticSeverity
  message: string
  filename: string
  source: CompilerDiagnosticSource
  loc?: SourceSpan
}

/**
 * 携带结构化编译诊断的致命错误。
 */
export class CompilerDiagnosticError extends Error implements CompilerDiagnostic {
  readonly code: CompilerDiagnosticCode
  readonly severity: CompilerDiagnosticSeverity
  readonly filename: string
  readonly source: CompilerDiagnosticSource
  readonly loc?: SourceSpan
  declare readonly cause?: unknown

  constructor(diagnostic: CompilerDiagnostic, options?: { cause?: unknown }) {
    super(diagnostic.message, options)
    this.name = 'CompilerDiagnosticError'
    this.code = diagnostic.code
    this.severity = diagnostic.severity
    this.filename = diagnostic.filename
    this.source = diagnostic.source
    this.loc = diagnostic.loc
  }
}
