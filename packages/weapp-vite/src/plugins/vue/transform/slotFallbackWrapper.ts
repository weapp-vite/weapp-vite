import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import {
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE,
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_GLOBAL_PATH,
  WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME,
} from '@weapp-core/constants'
import { createJsonMerger } from 'wevu/compiler'
import { resolveJson } from '../../../utils'
import { resolveBundleOutputExtensions } from './bundle/outputExtensions'
import { emitSfcJsonAsset, emitSfcTemplateIfMissing } from './emitAssets'
import { resolveVueTransformJsonPlatformOptions } from './platform'

interface Emitter {
  emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void
}

interface BundleAsset {
  type: 'asset'
  fileName?: string
  source?: string | Uint8Array
}

const slotFallbackWrapperUsageByBundle = new WeakMap<Record<string, any>, Set<string>>()
const slotFallbackWrapperScriptByBundle = new WeakMap<Record<string, any>, Map<string, string>>()

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

function stringifyJson(json: Record<string, any>) {
  return JSON.stringify(json, null, 2)
}

function isAsset(value: any): value is BundleAsset {
  return value?.type === 'asset'
}

function getAssetSource(asset: BundleAsset | undefined) {
  return asset?.source?.toString?.() ?? ''
}

function upsertSlotFallbackWrapperUsingComponent(json: Record<string, any>) {
  const usingComponents = json.usingComponents && typeof json.usingComponents === 'object' && !Array.isArray(json.usingComponents)
    ? { ...json.usingComponents }
    : {}
  usingComponents[WEVU_SLOT_FALLBACK_VIRTUAL_HOST_TAG_NAME] = WEVU_SLOT_FALLBACK_VIRTUAL_HOST_GLOBAL_PATH
  json.usingComponents = usingComponents
  return json
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

function getSlotFallbackWrapperUsage(bundle: Record<string, any>) {
  let usage = slotFallbackWrapperUsageByBundle.get(bundle)
  if (!usage) {
    usage = new Set<string>()
    slotFallbackWrapperUsageByBundle.set(bundle, usage)
  }
  return usage
}

function markSlotFallbackWrapperUsage(bundle: Record<string, any>, relativeBase: string) {
  getSlotFallbackWrapperUsage(bundle).add(relativeBase)
}

function getSlotFallbackWrapperScriptCache(bundle: Record<string, any>) {
  let cache = slotFallbackWrapperScriptByBundle.get(bundle)
  if (!cache) {
    cache = new Map<string, string>()
    slotFallbackWrapperScriptByBundle.set(bundle, cache)
  }
  return cache
}

function injectSlotFallbackWrapperIntoJsonAsset(
  bundle: Record<string, any>,
  jsonFileName: string,
  compilerCtx?: Pick<CompilerContext, 'configService'>,
) {
  const output = bundle[jsonFileName]
  if (!isAsset(output)) {
    return false
  }

  const json = upsertSlotFallbackWrapperUsingComponent(parseJsonSafely(getAssetSource(output)))
  output.source = stringifyJson(normalizeJsonConfigForPlatform(json, compilerCtx))
  return true
}

export function injectGlobalSlotFallbackWrapperUsingComponent(
  bundle: Record<string, any>,
  compilerCtx?: Pick<CompilerContext, 'configService'>,
  outputExtensions?: NonNullable<CompilerContext['configService']>['outputExtensions'],
) {
  const { jsonExtension } = resolveBundleOutputExtensions(outputExtensions)
  const usage = slotFallbackWrapperUsageByBundle.get(bundle)
  if (!usage?.size) {
    return false
  }

  if (injectSlotFallbackWrapperIntoJsonAsset(bundle, `app.${jsonExtension}`, compilerCtx)) {
    return true
  }

  for (const relativeBase of usage) {
    injectSlotFallbackWrapperIntoJsonAsset(bundle, `${relativeBase}.${jsonExtension}`, compilerCtx)
  }
  return false
}

function hasGlobalSlotFallbackWrapperUsingComponentAsset(
  bundle: Record<string, any>,
  outputExtensions?: NonNullable<CompilerContext['configService']>['outputExtensions'],
) {
  const { jsonExtension } = resolveBundleOutputExtensions(outputExtensions)
  return isAsset(bundle[`app.${jsonExtension}`])
}

export function injectLocalSlotFallbackWrapperUsingComponentIfNeeded(options: {
  bundle: Record<string, any>
  result: Pick<VueTransformResult, 'config' | 'slotFallbackWrapperComponent'>
  compilerCtx?: Pick<CompilerContext, 'configService'>
  outputExtensions?: NonNullable<CompilerContext['configService']>['outputExtensions']
}) {
  const component = options.result.slotFallbackWrapperComponent
  if (!component || hasGlobalSlotFallbackWrapperUsingComponentAsset(options.bundle, options.outputExtensions)) {
    return false
  }

  const config = upsertSlotFallbackWrapperUsingComponent(parseJsonSafely(options.result.config))
  options.result.config = stringifyJson(normalizeJsonConfigForPlatform(config, options.compilerCtx))
  return true
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
  const cache = getSlotFallbackWrapperScriptCache(bundle)
  if (cache.get(fileName) === script) {
    return
  }
  if (!existing) {
    ctx.emitFile({ type: 'asset', fileName, source: script })
    cache.set(fileName, script)
  }
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
  const componentBase = WEVU_SLOT_FALLBACK_VIRTUAL_HOST_BASE
  markSlotFallbackWrapperUsage(options.bundle, options.relativeBase)
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
