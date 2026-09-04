import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { WevuBindingManifestV1, WevuRuntimeBindingManifestMode } from '../../../../types/bindingManifest'
import type { SourcePosition } from '../../../../types/diagnostics'
import type { TemplateCompileOptions, TemplateCompileResult } from '../../compiler/template'
import type { VueTransformResult } from './types'
import { createRuntimeBindingManifest } from '../../../../bindingManifest'
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

function ownExternalTemplateDiagnostics(
  diagnostics: TemplateCompileResult['diagnostics'],
  filename: string,
  source: string,
) {
  const lineStarts = [0]
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    lineStarts.push(match.index + match[0].length)
  }
  const own = (position: SourcePosition) => {
    let low = 0
    let high = lineStarts.length
    while (low + 1 < high) {
      const middle = (low + high) >> 1
      if (lineStarts[middle] <= position.offset) {
        low = middle
      }
      else {
        high = middle
      }
    }
    const line = low + 1
    return {
      offset: position.offset,
      line,
      column: position.offset - lineStarts[line - 1] + 1,
    }
  }
  for (const diagnostic of diagnostics) {
    diagnostic.filename = filename
    if (diagnostic.loc) {
      diagnostic.loc = {
        start: own(diagnostic.loc.start),
        end: own(diagnostic.loc.end),
      }
    }
  }
}
function updateTemplateBindingManifests(
  templateCompiled: TemplateCompileResult,
  sourceFile: string,
  remap: ((position: SourcePosition) => SourcePosition) | undefined,
  runtimeBindingManifest: WevuRuntimeBindingManifestMode,
) {
  const updateManifest = (manifest: WevuBindingManifestV1) => {
    manifest.sourceFile = sourceFile
    if (!remap) {
      return
    }
    for (const binding of manifest.bindings) {
      if (binding.sourceLocation) {
        binding.sourceLocation = {
          start: remap(binding.sourceLocation.start),
          end: remap(binding.sourceLocation.end),
        }
      }
    }
  }
  updateManifest(templateCompiled.bindingManifest)
  for (const asset of templateCompiled.scopedSlotComponents ?? []) {
    const previousManifest = JSON.stringify(createRuntimeBindingManifest(asset.bindingManifest, runtimeBindingManifest))
    updateManifest(asset.bindingManifest)
    const nextManifest = JSON.stringify(createRuntimeBindingManifest(asset.bindingManifest, runtimeBindingManifest))
    asset.script = asset.script.replace(previousManifest, nextManifest)
  }
}

export function compileTemplatePhase(
  descriptor: Pick<SFCDescriptor, 'template'>,
  filename: string,
  source: string,
  templateResolvedId: string | undefined,
  options: TemplateCompileOptions | undefined,
  result: VueTransformResult,
  bindingManifestSourceFile?: string,
): TemplateCompileResult | undefined {
  if (!descriptor.template) {
    return undefined
  }

  const templateCompiled = compileVueTemplateToWxml(
    descriptor.template.content,
    filename,
    options,
  )
  const manifestSourceFile = descriptor.template.src || bindingManifestSourceFile || templateResolvedId || filename
  const runtimeBindingManifest = options?.runtimeBindingManifest ?? 'compact'
  if (descriptor.template.src) {
    updateTemplateBindingManifests(templateCompiled, manifestSourceFile, undefined, runtimeBindingManifest)
  }
  else {
    const base = descriptor.template.loc.start
    const lineStarts = [0]
    for (const match of source.matchAll(/\r\n?|\n/g)) {
      lineStarts.push(match.index + match[0].length)
    }
    updateTemplateBindingManifests(templateCompiled, manifestSourceFile, (position) => {
      const line = base.line + position.line - 1
      const column = position.line === 1
        ? base.column + position.column - 1
        : position.column
      return {
        offset: Math.min(source.length, (lineStarts[line - 1] ?? base.offset + position.offset) + column - 1),
        line,
        column,
      }
    }, runtimeBindingManifest)
  }
  result.bindingManifest = templateCompiled.bindingManifest
  result.template = templateCompiled.code
  if (templateCompiled.diagnostics.length) {
    if (descriptor.template.src) {
      if (templateResolvedId) {
        ownExternalTemplateDiagnostics(
          templateCompiled.diagnostics,
          templateResolvedId,
          descriptor.template.content,
        )
      }
      else {
        for (const diagnostic of templateCompiled.diagnostics) {
          diagnostic.loc = undefined
        }
      }
    }
    else {
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
