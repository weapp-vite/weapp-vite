import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { MpPlatform } from '../types'
import type { RewriteWevuInternalRuntimeImportsOptions } from './core/helpers'
import { Buffer } from 'node:buffer'
import {
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
} from '@weapp-core/constants'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import path from 'pathe'
import { parseLogicalEntryId, parseSidecarModuleId } from '../moduleGraph/protocol'
import { getWxmlPlatformTransformOptions } from '../platform'
import { changeFileExtension } from '../utils'
import { handleWxml, scanWxml } from '../wxml'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from './core/helpers'
import { restoreNativePageLayoutOutputs } from './outputFinalizer/pageLayout'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i
const TEMPLATE_ASSET_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i
const TEMPLATE_STATIC_REWRITE_MARKERS = [
  '@',
  '<!--',
  '<wxs',
  '</wxs',
  '<sjs',
  '</sjs',
  '.html',
  '.wxs',
  '.sjs',
  '.wxml',
  '.axml',
  '.swan',
  '.ttml',
  '.jxml',
  '.qml',
  '.ksml',
  '.xhsml',
  'import.meta.',
] as const
const TEMPLATE_DIRECTIVE_PREFIXES = getSupportedMiniProgramDirectivePrefixes()
type EmitAsset = (asset: EmittedAsset) => void
interface OutputAssetEntry {
  bundleFileName: string
  output: Extract<OutputBundle[string], { type: 'asset' }>
}

const GRAPH_ONLY_OUTPUT_MARKERS = [
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
]

function parseGraphOnlyAssetOwner(fileName: string) {
  for (const marker of GRAPH_ONLY_OUTPUT_MARKERS) {
    const markerIndex = fileName.indexOf(marker)
    if (markerIndex < 0) {
      continue
    }
    const request = fileName.slice(markerIndex)
    const extension = path.extname(request)
    const moduleId = `${extension ? request.slice(0, -extension.length) : request}.js`
    return parseLogicalEntryId(moduleId)?.sourceId
      ?? parseSidecarModuleId(moduleId)?.ownerId
  }
}

export function normalizeGraphOnlyAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
  emitAsset: EmitAsset,
) {
  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    const ownerId = parseGraphOnlyAssetOwner(fileName)
    if (!ownerId) {
      continue
    }
    delete bundle[bundleFileName]
    const outputFileName = ctx.configService.relativeOutputPath(
      changeFileExtension(ownerId, ctx.configService.outputExtensions.wxss),
    )
    if (!outputFileName) {
      continue
    }
    const existingOutput = bundle[outputFileName]
    if (existingOutput?.type === 'asset') {
      existingOutput.source = output.source
      existingOutput.fileName = outputFileName
      continue
    }
    if (!existingOutput) {
      emitAsset({
        type: 'asset',
        fileName: outputFileName,
        source: output.source,
      })
    }
  }
}

function collectOutputFinalizerAssetEntries(bundle: OutputBundle) {
  const preprocessorStyleAssets: OutputAssetEntry[] = []
  const templateAssets: OutputAssetEntry[] = []

  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    if (PREPROCESSOR_STYLE_ASSET_RE.test(fileName)) {
      preprocessorStyleAssets.push({ bundleFileName, output })
    }
    if (TEMPLATE_ASSET_RE.test(fileName)) {
      templateAssets.push({ bundleFileName, output })
    }
  }

  return {
    preprocessorStyleAssets,
    templateAssets,
  }
}

function outputSourceToString(output: OutputBundle[string]) {
  if (output.type === 'chunk') {
    return output.code
  }

  const source = output.source
  return typeof source === 'string'
    ? source
    : Buffer.from(source).toString('base64')
}

export function mayNeedTemplateNormalization(code: string, platform?: MpPlatform) {
  let lowerCode: string | undefined
  const readLowerCode = () => {
    lowerCode ??= code.toLowerCase()
    return lowerCode
  }
  const hasUppercase = /[A-Z]/.test(code)
  const { directivePrefix, eventBindingStyle, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  if (normalizeComponentTagName && hasUppercase) {
    return true
  }

  for (const prefix of TEMPLATE_DIRECTIVE_PREFIXES) {
    if (prefix !== directivePrefix) {
      const marker = prefix === 's' ? 's-' : `${prefix}:`
      if (code.includes(marker)) {
        return true
      }
    }
  }

  if (eventBindingStyle === 'alipay' && (
    readLowerCode().includes('bind')
    || readLowerCode().includes('catch')
    || readLowerCode().includes('capture-')
    || readLowerCode().includes('mut-bind')
  )) {
    return true
  }

  const normalizedCode = hasUppercase ? readLowerCode() : code
  return TEMPLATE_STATIC_REWRITE_MARKERS.some(marker => normalizedCode.includes(marker))
}

function normalizePreprocessorStyleAssetEntries(
  bundle: OutputBundle,
  entries: OutputAssetEntry[],
  styleExtension: string | undefined,
  emitAsset: EmitAsset,
) {
  if (!styleExtension) {
    return
  }

  for (const { bundleFileName, output } of entries) {
    const fileName = output.fileName || bundleFileName
    const outputFileName = changeFileExtension(fileName, styleExtension)
    if (!outputFileName || outputFileName === fileName) {
      continue
    }

    const existingOutput = bundle[outputFileName]
    delete bundle[bundleFileName]
    if (existingOutput?.type === 'asset') {
      existingOutput.source = output.source
      existingOutput.fileName = outputFileName
      continue
    }
    if (existingOutput) {
      continue
    }

    output.fileName = outputFileName
    const [name] = output.names ?? []
    const [originalFileName] = output.originalFileNames ?? []
    emitAsset({
      type: 'asset',
      fileName: outputFileName,
      ...(name ? { name } : {}),
      ...(originalFileName ? { originalFileName } : {}),
      source: output.source,
    })
  }
}

export function normalizePreprocessorStyleAssets(
  bundle: OutputBundle,
  styleExtension: string | undefined,
  emitAsset: EmitAsset,
) {
  if (!styleExtension) {
    return
  }

  normalizePreprocessorStyleAssetEntries(
    bundle,
    collectOutputFinalizerAssetEntries(bundle).preprocessorStyleAssets,
    styleExtension,
    emitAsset,
  )
}

function normalizeTemplateAssetEntries(
  ctx: CompilerContext,
  entries: OutputAssetEntry[],
) {
  const { configService } = ctx
  for (const { output } of entries) {
    const source = output.source
    const code = typeof source === 'string'
      ? source
      : source instanceof Uint8Array
        ? Buffer.from(source).toString('utf8')
        : undefined
    if (code === undefined) {
      continue
    }
    if (!mayNeedTemplateNormalization(code, configService?.platform)) {
      continue
    }

    const token = scanWxml(code, {
      platform: configService?.platform,
    })
    const result = handleWxml(token, {
      scriptModuleExtension: configService?.outputExtensions?.wxs,
      templateExtension: configService?.outputExtensions?.wxml,
    })
    if (result.code !== code) {
      output.source = result.code
    }
  }
}

export function normalizeTemplateAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  normalizeTemplateAssetEntries(ctx, collectOutputFinalizerAssetEntries(bundle).templateAssets)
}

export function pruneUneventedDevHmrChunks(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (
    !ctx.configService?.isDev
    || ctx.runtimeState?.build?.hmr?.profile?.event === undefined
    || !emittedChunkFileNames?.size
  ) {
    return
  }

  for (const [fileName, output] of Object.entries(bundle)) {
    if (
      output?.type === 'chunk'
      && !emittedChunkFileNames.has(fileName)
      && !emittedChunkFileNames.has(output.fileName)
    ) {
      delete bundle[fileName]
    }
  }
}

export function pruneUnchangedDevHmrOutputs(
  ctx: CompilerContext,
  bundle: OutputBundle,
  rewriteOptions?: RewriteWevuInternalRuntimeImportsOptions,
  options?: {
    runtimeRewriteDone?: boolean
  },
) {
  const cache = ctx.runtimeState?.build?.output?.emittedSource
  if (!ctx.configService?.isDev || !cache) {
    return
  }

  const isHmrBuild = ctx.runtimeState?.build?.hmr?.profile?.event !== undefined
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (!options?.runtimeRewriteDone) {
    rewriteWevuInternalRuntimeImports(bundle, rewriteOptions)
    stabilizeWevuRuntimeChunkAccess(bundle)
  }
  for (const [fileName, output] of Object.entries(bundle)) {
    const shouldForceEmitCurrentHmrChunk = isHmrBuild
      && output.type === 'chunk'
      && (
        emittedChunkFileNames?.has(fileName) === true
        || emittedChunkFileNames?.has(output.fileName) === true
      )
    if (
      isHmrBuild
      && output.type === 'chunk'
      && emittedChunkFileNames?.size
      && !shouldForceEmitCurrentHmrChunk
    ) {
      delete bundle[fileName]
      continue
    }
    const source = outputSourceToString(output)
    if (isHmrBuild && !shouldForceEmitCurrentHmrChunk && cache.get(fileName) === source) {
      delete bundle[fileName]
      continue
    }
    cache.set(fileName, source)
  }
}

export function createOutputFinalizerPlugin(ctx: CompilerContext): Plugin {
  const wevuRuntimeRewriteOptions: RewriteWevuInternalRuntimeImportsOptions = {
    get runtimeFileName() {
      return ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileName
    },
    get runtimeFileNames() {
      return ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileNames
    },
    onRuntimeFileName(fileName) {
      const outputState = ctx.runtimeState?.build?.output
      if (outputState) {
        outputState.wevuInternalRuntimeFileName = fileName
      }
    },
    onRuntimeModuleFileName(moduleId, fileName) {
      const outputState = ctx.runtimeState?.build?.output
      if (outputState) {
        outputState.wevuInternalRuntimeFileNames ??= new Map<string, string>()
        outputState.wevuInternalRuntimeFileNames.set(moduleId, fileName)
      }
    },
  }

  return {
    name: 'weapp-vite:output-finalizer',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const outputBundle = bundle as unknown as OutputBundle
        rewriteWevuInternalRuntimeImports(bundle as unknown as OutputBundle, wevuRuntimeRewriteOptions)
        stabilizeWevuRuntimeChunkAccess(bundle as unknown as OutputBundle)
        restoreNativePageLayoutOutputs(ctx, outputBundle)
        normalizeGraphOnlyAssets(ctx, outputBundle, asset => this.emitFile(asset))
        const assetEntries = collectOutputFinalizerAssetEntries(outputBundle)
        normalizePreprocessorStyleAssetEntries(
          outputBundle,
          assetEntries.preprocessorStyleAssets,
          ctx.configService.outputExtensions?.wxss,
          asset => this.emitFile(asset),
        )
        normalizeTemplateAssetEntries(ctx, assetEntries.templateAssets)
        pruneUnchangedDevHmrOutputs(ctx, outputBundle, wevuRuntimeRewriteOptions, {
          runtimeRewriteDone: true,
        })
      },
    },
  }
}
