import type { SourceLocation } from '@vue/compiler-core'
import type { CompilerDiagnosticSource } from '../../../../types/diagnostics'
import type { TransformContext } from './types'

type TemplateErrorCode = 'WV2002' | 'WV2001'

export function warn(
  context: Pick<TransformContext, 'diagnostics' | 'filename'>,
  message: string,
  location?: SourceLocation,
  source: CompilerDiagnosticSource = 'template',
  errorCode?: TemplateErrorCode,
) {
  context.diagnostics.push({
    code: errorCode ?? (source === 'expression' ? 'WV1002' : 'WV1001'),
    severity: errorCode ? 'error' : 'warning',
    message,
    filename: context.filename,
    source,
    loc: location ? { start: location.start, end: location.end } : undefined,
  })
}
