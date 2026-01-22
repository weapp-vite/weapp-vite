import type { JsonMergeStrategy } from '../../../../types'
import type { VueTransformResult } from '../compileVueFile'
import { createJsonMerger } from '../jsonMerge'

interface Emitter {
  emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void
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
  const fileName = `${relativeBase}.${extension}`
  const existing = bundle[fileName]
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== template) {
      existing.source = template
    }
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source: template })
}

export function emitSfcStyleIfMissing(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  style: string,
  extension = 'wxss',
) {
  const fileName = `${relativeBase}.${extension}`
  const existing = bundle[fileName]
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== style) {
      existing.source = style
    }
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source: style })
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
  const jsonFileName = `${relativeBase}.${options.extension ?? 'json'}`
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
    if (Object.prototype.hasOwnProperty.call(defaultConfig, 'component')) {
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
      ctx.emitFile({ type: 'asset', fileName: jsonFileName, source: JSON.stringify(nextConfig, null, 2) })
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
    return
  }

  ctx.emitFile({ type: 'asset', fileName: jsonFileName, source: JSON.stringify(nextConfig, null, 2) })
}

export function emitSfcScriptAssetReplacingBundleEntry(
  ctx: Emitter,
  bundle: Record<string, any>,
  relativeBase: string,
  code: string,
  extension = 'js',
) {
  const jsFileName = `${relativeBase}.${extension}`
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
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== source) {
      existing.source = source
    }
    return
  }
  ctx.emitFile({ type: 'asset', fileName, source })
}
