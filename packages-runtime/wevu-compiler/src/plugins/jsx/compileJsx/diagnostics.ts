import type { Node } from '@weapp-vite/ast/babelTypes'
import type { CompilerDiagnostic, CompilerDiagnosticCode, CompilerDiagnosticSeverity } from '../../../types/diagnostics'
import type { JsxCompileContext } from './types'
import { CompilerDiagnosticError } from '../../../types/diagnostics'

/** 保留兼容的字符串告警，同时携带可供构建入口消费的结构化诊断。 */
export function addJsxDiagnostic(
  context: JsxCompileContext,
  node: Node,
  code: CompilerDiagnosticCode,
  message: string,
  severity: CompilerDiagnosticSeverity = 'warning',
) {
  context.warningDiagnostics.set(context.warnings.length, {
    code,
    severity,
    message,
    filename: node.loc?.filename ?? context.filename ?? '',
    source: 'jsx',
    loc: node.loc && node.start != null && node.end != null
      ? {
          start: { offset: node.start, line: node.loc.start.line, column: node.loc.start.column + 1 },
          end: { offset: node.end, line: node.loc.end.line, column: node.loc.end.column + 1 },
        }
      : undefined,
  })
  context.warnings.push(message)
}

export function createJsxDiagnostics(
  warnings: string[],
  filename: string,
  metadata?: ReadonlyMap<number, CompilerDiagnostic>,
): CompilerDiagnostic[] {
  return warnings.map((warning, index) => {
    const message = warning.startsWith('[JSX 编译]') ? warning : `[JSX 编译] ${warning}`
    return {
      code: 'WV1003',
      severity: 'warning',
      filename,
      source: 'jsx',
      ...metadata?.get(index),
      message,
    }
  })
}

export function reportJsxDiagnostics(diagnostics: CompilerDiagnostic[] | undefined, warn?: (message: string) => void) {
  for (const diagnostic of diagnostics ?? []) {
    warn?.(diagnostic.message)
    if (diagnostic.severity === 'error') {
      throw new CompilerDiagnosticError(diagnostic)
    }
  }
}
