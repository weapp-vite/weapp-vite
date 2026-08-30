import type { Node } from '@weapp-vite/ast/babelTypes'
import type { CompilerDiagnosticCode, CompilerDiagnosticSeverity, SourceSpan } from '../../../types/diagnostics'
import type { JsxCompileContext } from './types'

export function resolveJsxSourceSpan(node: Node | null | undefined): SourceSpan | undefined {
  if (
    !node?.loc
    || typeof node.start !== 'number'
    || typeof node.end !== 'number'
  ) {
    return undefined
  }
  return {
    start: {
      offset: node.start,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
    },
    end: {
      offset: node.end,
      line: node.loc.end.line,
      column: node.loc.end.column + 1,
    },
  }
}

export function emitJsxDiagnostic(
  context: Pick<JsxCompileContext, 'diagnostics' | 'filename'>,
  code: CompilerDiagnosticCode,
  message: string,
  node?: Node | null,
  severity: CompilerDiagnosticSeverity = 'warning',
) {
  const loc = resolveJsxSourceSpan(node)
  context.diagnostics.push({
    code,
    severity,
    message,
    filename: context.filename ?? '<anonymous>',
    source: 'jsx',
    ...(loc ? { loc } : {}),
  })
}
