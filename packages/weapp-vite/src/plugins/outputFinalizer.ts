import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { MpPlatform } from '../types'
import type { RewriteWevuInternalRuntimeImportsOptions } from './core/helpers'
import { Buffer } from 'node:buffer'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { getWxmlPlatformTransformOptions } from '../platform'
import { changeFileExtension } from '../utils'
import { handleWxml, scanWxml } from '../wxml'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from './core/helpers'

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
  const lowerCode = code.toLowerCase()
  const { directivePrefix, eventBindingStyle, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  if (normalizeComponentTagName && /[A-Z]/.test(code)) {
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
    lowerCode.includes('bind')
    || lowerCode.includes('catch')
    || lowerCode.includes('capture-')
    || lowerCode.includes('mut-bind')
  )) {
    return true
  }

  return TEMPLATE_STATIC_REWRITE_MARKERS.some(marker => lowerCode.includes(marker))
}

export function normalizePreprocessorStyleAssets(
  bundle: OutputBundle,
  styleExtension: string | undefined,
  emitAsset: EmitAsset,
) {
  if (!styleExtension) {
    return
  }

  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    if (!PREPROCESSOR_STYLE_ASSET_RE.test(fileName)) {
      continue
    }

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

export function normalizeTemplateAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  const { configService } = ctx
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || !TEMPLATE_ASSET_RE.test(output.fileName)) {
      continue
    }

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
  pruneUneventedDevHmrChunks(ctx, bundle)
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
    generateBundle(_options, bundle) {
      rewriteWevuInternalRuntimeImports(bundle as unknown as OutputBundle, wevuRuntimeRewriteOptions)
      stabilizeWevuRuntimeChunkAccess(bundle as unknown as OutputBundle)
      normalizePreprocessorStyleAssets(
        bundle as unknown as OutputBundle,
        ctx.configService.outputExtensions?.wxss,
        asset => this.emitFile(asset),
      )
      normalizeTemplateAssets(ctx, bundle as unknown as OutputBundle)
      pruneUnchangedDevHmrOutputs(ctx, bundle as unknown as OutputBundle, wevuRuntimeRewriteOptions, {
        runtimeRewriteDone: true,
      })
    },
  }
}
