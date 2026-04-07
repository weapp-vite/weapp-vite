import type { VueTransformResult } from 'wevu/compiler'
import type { JsonMergeStrategy } from '../../../types'
import { createJsonMerger } from 'wevu/compiler'

interface Emitter {
  emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void
}

const emittedAssetSourceCache = new Map<string, string>()

/**
 * 统一拼接 SFC 相关产物文件名。
 */
export function resolveSfcAssetFileName(
  relativeBase: string,
  extension: string,
) {
  return `${relativeBase}.${extension}`
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

export function emitSfcTemplateIfMissing(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  template: string,
  extension = 'wxml',
) {
  const fileName = resolveSfcAssetFileName(relativeBase, extension)
  const cacheKey = `asset:${fileName}`
  const existing = bundle[fileName]
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== template) {
      existing.source = template
    }
    emittedAssetSourceCache.set(cacheKey, template)
    return
  }
  if (emittedAssetSourceCache.get(cacheKey) === template) {
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source: template })
  emittedAssetSourceCache.set(cacheKey, template)
}

export function emitSfcStyleIfMissing(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  style: string,
  extension = 'wxss',
) {
  const fileName = resolveSfcAssetFileName(relativeBase, extension)
  const cacheKey = `asset:${fileName}`
  const existing = bundle[fileName]
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== style) {
      existing.source = style
    }
    emittedAssetSourceCache.set(cacheKey, style)
    return
  }
  if (emittedAssetSourceCache.get(cacheKey) === style) {
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source: style })
  emittedAssetSourceCache.set(cacheKey, style)
}

export function emitSfcJsonAsset(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  result: Pick<VueTransformResult, 'config'>,
  options: {
    defaultConfig?: Record<string, any>
    mergeExistingAsset?: boolean
    emitIfMissingOnly?: boolean
    mergeStrategy?: JsonMergeStrategy
    defaults?: Record<string, any>
    kind?: 'app' | 'page' | 'component'
    extension?: string
  },
) {
  const jsonFileName = resolveSfcAssetFileName(relativeBase, options.extension ?? 'json')
  const cacheKey = `asset:${jsonFileName}`
  const existing = bundle[jsonFileName]
  const mergeJson = createJsonMerger(options.mergeStrategy, {
    filename: jsonFileName,
    kind: options.kind ?? 'unknown',
  })

  const defaultConfig = options.defaultConfig
  let nextConfig: Record<string, any> | undefined = parseJsonSafely(result.config)
  if (!nextConfig && options.defaults) {
    nextConfig = mergeJson({}, options.defaults, 'defaults')
  }

  if (defaultConfig) {
    nextConfig = mergeJson(defaultConfig, nextConfig ?? {}, 'emit')
  }

  if (defaultConfig && nextConfig) {
    if (
      Object.hasOwn(defaultConfig, 'component')
      && !Object.hasOwn(nextConfig, 'component')
    ) {
      nextConfig.component = true
    }
  }

  if (!nextConfig && defaultConfig) {
    nextConfig = defaultConfig
  }

  if (!nextConfig) {
    return
  }

  if (options.emitIfMissingOnly) {
    if (!bundle[jsonFileName]) {
      const nextSource = JSON.stringify(nextConfig, null, 2)
      if (emittedAssetSourceCache.get(cacheKey) !== nextSource) {
        ctx.emitFile({ type: 'asset', fileName: jsonFileName, source: nextSource })
        emittedAssetSourceCache.set(cacheKey, nextSource)
      }
    }
    return
  }

  if (options.mergeExistingAsset && existing && existing.type === 'asset') {
    try {
      const existingConfig = JSON.parse(existing.source.toString())
      const merged = mergeJson(existingConfig, nextConfig, 'merge-existing')
      existing.source = JSON.stringify(merged, null, 2)
    }
    catch {
      existing.source = JSON.stringify(nextConfig, null, 2)
    }
    return
  }

  if (existing && existing.type === 'asset') {
    const nextSource = JSON.stringify(nextConfig, null, 2)
    const current = existing.source?.toString?.() ?? ''
    if (current !== nextSource) {
      existing.source = nextSource
    }
    emittedAssetSourceCache.set(cacheKey, nextSource)
    return
  }

  const nextSource = JSON.stringify(nextConfig, null, 2)
  if (emittedAssetSourceCache.get(cacheKey) === nextSource) {
    return
  }
  ctx.emitFile({ type: 'asset', fileName: jsonFileName, source: nextSource })
  emittedAssetSourceCache.set(cacheKey, nextSource)
}

export function emitSfcScriptAssetReplacingBundleEntry(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  code: string,
  extension = 'js',
) {
  const jsFileName = resolveSfcAssetFileName(relativeBase, extension)
  if (bundle[jsFileName]) {
    delete bundle[jsFileName]
  }
  ctx.emitFile({ type: 'asset', fileName: jsFileName, source: code })
}

export function emitClassStyleWxsAssetIfMissing(
  ctx: Emitter,
  bundle: Record<string, any>,
  fileName: string,
  source: string,
) {
  const existing = bundle[fileName]
  const cacheKey = `asset:${fileName}`
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== source) {
      existing.source = source
    }
    emittedAssetSourceCache.set(cacheKey, source)
    return
  }
  if (emittedAssetSourceCache.get(cacheKey) === source) {
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source })
  emittedAssetSourceCache.set(cacheKey, source)
}
