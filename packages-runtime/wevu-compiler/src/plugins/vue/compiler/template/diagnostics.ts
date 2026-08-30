import type { SourceLocation } from '@vue/compiler-core'
import type { CompilerDiagnosticCode, CompilerDiagnosticSeverity, CompilerDiagnosticSource, SourcePosition, SourceSpan } from '../../../../types/diagnostics'
import type { TransformContext } from './types'

function offsetPosition(position: SourcePosition, base?: SourcePosition): SourcePosition {
  if (!base) {
    return position
  }
  return {
    offset: base.offset + position.offset,
    line: base.line + position.line - 1,
    column: position.line === 1 ? base.column + position.column - 1 : position.column,
  }
}

export function resolveTemplateSourceSpan(
  location: SourceLocation | undefined,
  base?: SourcePosition,
): SourceSpan | undefined {
  if (!location) {
    return undefined
  }
  return {
    start: offsetPosition(location.start, base),
    end: offsetPosition(location.end, base),
  }
}
type TemplateDiagnosticContext = Pick<
  TransformContext,
  'diagnostics' | 'filename' | 'sourceLocationLineStarts' | 'sourceLocationOffset' | 'sourceLocationSource'
>

function collectLineStarts(source: string) {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    if (code === 13) {
      if (source.charCodeAt(index + 1) === 10) {
        index += 1
      }
      starts.push(index + 1)
    }
    else if (code === 10) {
      starts.push(index + 1)
    }
  }
  return starts
}

function remapPositionOffset(context: TemplateDiagnosticContext, position: SourcePosition) {
  const source = context.sourceLocationSource
  if (!source) {
    return position
  }
  const lineStarts = context.sourceLocationLineStarts
    ??= collectLineStarts(source)
  const lineStart = lineStarts[position.line - 1]
  if (lineStart === undefined) {
    return position
  }
  return {
    ...position,
    offset: Math.min(source.length, lineStart + position.column - 1),
  }
}

function remapSpanOffsets(context: TemplateDiagnosticContext, span: SourceSpan | undefined) {
  if (!span) {
    return undefined
  }
  return {
    start: remapPositionOffset(context, span.start),
    end: remapPositionOffset(context, span.end),
  }
}

export function emitTemplateDiagnostic(
  context: TemplateDiagnosticContext,
  code: CompilerDiagnosticCode,
  message: string,
  location?: SourceLocation,
  severity: CompilerDiagnosticSeverity = 'warning',
  source: CompilerDiagnosticSource = 'template',
) {
  const loc = remapSpanOffsets(
    context,
    resolveTemplateSourceSpan(location, context.sourceLocationOffset),
  )
  context.diagnostics.push({
    code,
    severity,
    message,
    filename: context.filename,
    source,
    ...(loc ? { loc } : {}),
  })
}
