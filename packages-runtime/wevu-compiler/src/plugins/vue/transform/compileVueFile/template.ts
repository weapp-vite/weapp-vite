import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { SourcePosition } from '../../../../types/diagnostics'
import type { TemplateCompileOptions, TemplateCompileResult } from '../../compiler/template'
import type { VueTransformResult } from './types'
import { compileVueTemplateToWxml } from '../../compiler/template'

function remapTemplateDiagnostics(
  diagnostics: TemplateCompileResult['diagnostics'],
  base: SourcePosition,
  source: string,
) {
  const lineStarts = [0]
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    lineStarts.push(match.index + match[0].length)
  }
  const remap = (position: SourcePosition) => {
    const line = base.line + position.line - 1
    const column = position.line === 1
      ? base.column + position.column - 1
      : position.column
    return {
      offset: Math.min(source.length, (lineStarts[line - 1] ?? base.offset + position.offset) + column - 1),
      line,
      column,
    }
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.loc) {
      diagnostic.loc = {
        start: remap(diagnostic.loc.start),
        end: remap(diagnostic.loc.end),
      }
    }
  }
}

export function compileTemplatePhase(
  descriptor: Pick<SFCDescriptor, 'template'>,
  filename: string,
  source: string,
  options: TemplateCompileOptions | undefined,
  result: VueTransformResult,
): TemplateCompileResult | undefined {
  if (!descriptor.template) {
    return undefined
  }

  const templateCompiled = compileVueTemplateToWxml(
    descriptor.template.content,
    filename,
    options,
  )
  result.template = templateCompiled.code
  if (templateCompiled.diagnostics.length) {
    if (!descriptor.template.src) {
      remapTemplateDiagnostics(templateCompiled.diagnostics, descriptor.template.loc.start, source)
    }
    result.diagnostics = templateCompiled.diagnostics
  }
  if (templateCompiled.scopedSlotComponents?.length) {
    result.scopedSlotComponents = templateCompiled.scopedSlotComponents
  }
  if (templateCompiled.slotFallbackWrapperComponent) {
    result.slotFallbackWrapperComponent = templateCompiled.slotFallbackWrapperComponent
  }
  if (templateCompiled.componentGenerics && Object.keys(templateCompiled.componentGenerics).length) {
    result.componentGenerics = templateCompiled.componentGenerics
  }
  if (templateCompiled.classStyleWxs) {
    result.classStyleWxs = true
  }

  return templateCompiled
}
