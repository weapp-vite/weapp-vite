import type { SourceLocation } from '@vue/compiler-core'
import type { CompilerDiagnosticCode, CompilerDiagnosticSeverity, CompilerDiagnosticSource } from '../../../../types/diagnostics'
import type { TransformContext } from './types'

type TemplateErrorCode = 'WV2002' | 'WV2001'

export interface WarnOptions {
  code?: CompilerDiagnosticCode
  severity?: CompilerDiagnosticSeverity
}

export function warn(
  context: Pick<TransformContext, 'diagnostics' | 'filename'>,
  message: string,
  location?: SourceLocation,
  source: CompilerDiagnosticSource = 'template',
  options?: TemplateErrorCode | WarnOptions,
) {
  const normalized = typeof options === 'string'
    ? { code: options, severity: 'error' as const }
    : options
  context.diagnostics.push({
    code: normalized?.code ?? (source === 'expression' ? 'WV1002' : 'WV1001'),
    severity: normalized?.severity ?? 'warning',
    message,
    filename: context.filename,
    source,
    loc: location ? { start: location.start, end: location.end } : undefined,
  })
}
