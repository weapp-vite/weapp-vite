import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import type { JsonMergeStrategy } from '../../../../types'
import { createJsonMerger } from 'wevu/compiler'
import { resolveJson } from '../../../../utils'
import { toPosixPath } from '../../../../utils/path'
import { resolveBundleOutputExtensions } from '../bundle/outputExtensions'
import { emitClassStyleWxsAssetIfMissing } from '../emitAssets'
import { resolveVueTransformJsonPlatformOptions } from '../platform'

interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

function parseJsonSafely(source: string | undefined): Record<string, any> | undefined {
  if (!source) {
    return undefined
  }
  try {
    return JSON.parse(source)
  }
  catch {
    return undefined
  }
}

function normalizeJsonConfigForPlatform(
  json: Record<string, any>,
  compilerCtx?: Pick<CompilerContext, 'configService'>,
) {
  const jsonPlatformOptions = resolveVueTransformJsonPlatformOptions(compilerCtx?.configService)
  if (!jsonPlatformOptions.normalizeUsingComponents) {
    return json
  }

  try {
    const source = resolveJson(
      { json },
      undefined,
      jsonPlatformOptions.platform as any,
      {
        dependencies: jsonPlatformOptions.dependencies,
        alipayNpmMode: jsonPlatformOptions.alipayNpmMode,
      },
    )
    if (!source) {
      return json
    }

    return JSON.parse(source)
  }
  catch {
    return json
  }
}

function resolveScopedSlotAutoImports(
  compilerCtx: Pick<CompilerContext, 'autoImportService' | 'wxmlService'> | undefined,
  baseUsingComponents: Record<string, string>,
  componentBase: string,
  template: string,
): Record<string, string> {
  const autoImportService = compilerCtx?.autoImportService
  const wxmlService = compilerCtx?.wxmlService
  if (!autoImportService || !wxmlService) {
    return { ...baseUsingComponents }
  }

  const usingComponents: Record<string, string> = {}

  try {
    const token = wxmlService.analyze(template)
    const depComponentNames = Object.keys(token.components ?? {})
    for (const depComponentName of depComponentNames) {
      if (Object.hasOwn(baseUsingComponents, depComponentName)) {
        usingComponents[depComponentName] = baseUsingComponents[depComponentName]
        continue
      }

      const match = autoImportService.resolve(depComponentName, componentBase)
      if (!match) {
        continue
      }
      const { value } = match
      if (Object.hasOwn(usingComponents, value.name)) {
        continue
      }
      usingComponents[value.name] = value.from
    }
  }
  catch {
    return { ...baseUsingComponents }
  }

  return usingComponents
}

export function emitScopedSlotAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  result: VueTransformResult,
  compilerCtx?: Pick<CompilerContext, 'autoImportService' | 'wxmlService' | 'configService'>,
  classStyleWxs?: ClassStyleWxsAsset,
  outputExtensions?: OutputExtensions,
  jsonOptions?: {
    defaults?: Record<string, any>
    mergeStrategy?: JsonMergeStrategy
  },
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  const { templateExtension, jsonExtension } = resolveBundleOutputExtensions(outputExtensions)
  const configObj = parseJsonSafely(result.config) ?? {}
  const baseUsingComponents: Record<string, string> = (configObj.usingComponents && typeof configObj.usingComponents === 'object' && !Array.isArray(configObj.usingComponents))
    ? { ...configObj.usingComponents }
    : {}
  const usingComponents: Record<string, string> = { ...baseUsingComponents }

  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const componentPath = `/${toPosixPath(componentBase)}`
    usingComponents[scopedSlot.componentName] = componentPath

    const wxmlFile = `${componentBase}.${templateExtension}`
    const jsonFile = `${componentBase}.${jsonExtension}`
    const scopedUsingComponents = resolveScopedSlotAutoImports(
      compilerCtx,
      baseUsingComponents,
      componentBase,
      scopedSlot.template,
    )

    if (!bundle[wxmlFile]) {
      ctx.emitFile({ type: 'asset', fileName: wxmlFile, source: scopedSlot.template })
    }
    if (!bundle[jsonFile]) {
      const mergeJson = createJsonMerger(jsonOptions?.mergeStrategy, {
        filename: jsonFile,
        kind: 'component',
      })
      let json = mergeJson({}, { usingComponents: scopedUsingComponents }, 'auto-using-components')
      if (jsonOptions?.defaults && Object.keys(jsonOptions.defaults).length > 0) {
        json = mergeJson(json, jsonOptions.defaults, 'defaults')
      }
      const defaultConfig = { component: true, styleIsolation: 'apply-shared' }
      json = mergeJson(defaultConfig, json, 'emit')
      if (Object.hasOwn(defaultConfig, 'component')) {
        json.component = true
      }
      const normalizedJson = normalizeJsonConfigForPlatform(json, compilerCtx)
      ctx.emitFile({ type: 'asset', fileName: jsonFile, source: JSON.stringify(normalizedJson, null, 2) })
    }
    if (scopedSlot.classStyleWxs && classStyleWxs) {
      emitClassStyleWxsAssetIfMissing(
        ctx,
        bundle,
        classStyleWxs.fileName,
        classStyleWxs.source,
      )
    }
  }

  configObj.usingComponents = usingComponents
  result.config = JSON.stringify(normalizeJsonConfigForPlatform(configObj, compilerCtx), null, 2)
}
