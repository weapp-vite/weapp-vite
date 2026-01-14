import type { TemplateCompileOptions, TemplateCompileResult } from '../../compiler/template'
import type { VueTransformResult } from './types'
import { compileVueTemplateToWxml } from '../../compiler/template'

export function compileTemplatePhase(
  descriptor: { template?: { content: string } },
  filename: string,
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
  if (templateCompiled.scopedSlotComponents?.length) {
    result.scopedSlotComponents = templateCompiled.scopedSlotComponents
  }
  if (templateCompiled.componentGenerics && Object.keys(templateCompiled.componentGenerics).length) {
    result.componentGenerics = templateCompiled.componentGenerics
  }
  if (templateCompiled.classStyleWxs) {
    result.classStyleWxs = true
  }

  return templateCompiled
}
