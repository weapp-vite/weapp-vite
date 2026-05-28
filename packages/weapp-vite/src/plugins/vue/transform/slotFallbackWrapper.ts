import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import { createJsonMerger } from 'wevu/compiler'
import { resolveJson } from '../../../utils'
import { toPosixPath } from '../../../utils/path'
import { resolveBundleOutputExtensions } from './bundle/outputExtensions'
import { emitSfcJsonAsset, emitSfcTemplateIfMissing } from './emitAssets'
import { resolveVueTransformJsonPlatformOptions } from './platform'

interface Emitter {
  emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void
}

function parseJsonSafely(source: string | undefined): Record<string, any> {
  if (!source) {
    return {}
  }
  try {
    const parsed = JSON.parse(source)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : {}
  }
  catch {
    return {}
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
    return source ? JSON.parse(source) : json
  }
  catch {
    return json
  }
}

function emitSlotFallbackWrapperScriptIfMissing(
  ctx: Emitter,
  bundle: Record<string, any>,
  fileName: string,
  script: string,
) {
  const existing = bundle[fileName]
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== script) {
      existing.source = script
    }
    return
  }
  if (!existing) {
    ctx.emitFile({ type: 'asset', fileName, source: script })
  }
}

export function injectSlotFallbackWrapperUsingComponent(
  result: Pick<VueTransformResult, 'config' | 'slotFallbackWrapperComponent'>,
  relativeBase: string,
  compilerCtx?: Pick<CompilerContext, 'configService'>,
) {
  const component = result.slotFallbackWrapperComponent
  if (!component) {
    return
  }

  const config = parseJsonSafely(result.config)
  const usingComponents = config.usingComponents && typeof config.usingComponents === 'object' && !Array.isArray(config.usingComponents)
    ? { ...config.usingComponents }
    : {}
  usingComponents[component.tagName] = `/${toPosixPath(`${relativeBase}.${component.componentBase}`)}`
  config.usingComponents = usingComponents
  result.config = JSON.stringify(normalizeJsonConfigForPlatform(config, compilerCtx), null, 2)
}

export function emitSlotFallbackWrapperComponentAsset(options: {
  ctx: Emitter
  bundle: Record<string, any>
  relativeBase: string
  result: Pick<VueTransformResult, 'slotFallbackWrapperComponent'>
  compilerCtx?: Pick<CompilerContext, 'configService'>
  outputExtensions?: NonNullable<CompilerContext['configService']>['outputExtensions']
  jsonOptions?: {
    defaults?: Record<string, any>
    mergeStrategy?: any
  }
}) {
  const component = options.result.slotFallbackWrapperComponent
  if (!component) {
    return
  }

  const { templateExtension, jsonExtension, scriptExtension } = resolveBundleOutputExtensions(options.outputExtensions)
  const componentBase = `${options.relativeBase}.${component.componentBase}`
  emitSfcTemplateIfMissing(
    options.ctx,
    options.bundle,
    componentBase,
    component.template,
    templateExtension,
  )

  const jsonFileName = `${componentBase}.${jsonExtension}`
  const mergeJson = createJsonMerger(options.jsonOptions?.mergeStrategy, {
    filename: jsonFileName,
    kind: 'component',
  })
  let config = component.config
  if (options.jsonOptions?.defaults && Object.keys(options.jsonOptions.defaults).length > 0) {
    config = mergeJson(config, options.jsonOptions.defaults, 'defaults')
  }
  emitSfcJsonAsset(options.ctx, options.bundle, componentBase, {
    config: JSON.stringify(normalizeJsonConfigForPlatform(config, options.compilerCtx), null, 2),
  }, {
    kind: 'component',
    extension: jsonExtension,
  })
  emitSlotFallbackWrapperScriptIfMissing(
    options.ctx,
    options.bundle,
    `${componentBase}.${scriptExtension}`,
    component.script,
  )
}
