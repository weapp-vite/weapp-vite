export const CompilerDiagnosticCodes = {
  jsxAnalysisError: 'WEVU_JSX_ANALYSIS_ERROR',
  jsxDynamicIsland: 'WEVU_JSX_DYNAMIC_ISLAND',
  jsxRuntimeRequired: 'WEVU_JSX_RUNTIME_REQUIRED',
  jsxUnsupportedSyntax: 'WEVU_JSX_UNSUPPORTED_SYNTAX',
  templateCompileError: 'WEVU_TEMPLATE_COMPILE_ERROR',
  templateInvalidBinding: 'WEVU_TEMPLATE_INVALID_BINDING',
  templateInvalidExpression: 'WEVU_TEMPLATE_INVALID_EXPRESSION',
  templateInvalidLayoutHost: 'WEVU_TEMPLATE_INVALID_LAYOUT_HOST',
  templateInvalidSlot: 'WEVU_TEMPLATE_INVALID_SLOT',
  templateParseError: 'WEVU_TEMPLATE_PARSE_ERROR',
  templateRuntimeRequired: 'WEVU_TEMPLATE_RUNTIME_REQUIRED',
  templateUnsupportedDirective: 'WEVU_TEMPLATE_UNSUPPORTED_DIRECTIVE',
} as const

export type CompilerDiagnosticCode = typeof CompilerDiagnosticCodes[keyof typeof CompilerDiagnosticCodes]
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
