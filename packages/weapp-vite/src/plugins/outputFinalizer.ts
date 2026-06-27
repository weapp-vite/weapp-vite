import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { RewriteWevuInternalRuntimeImportsOptions } from './core/helpers'
import { Buffer } from 'node:buffer'
import { changeFileExtension } from '../utils'
import { handleWxml, scanWxml } from '../wxml'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from './core/helpers'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i
const TEMPLATE_ASSET_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i
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
) {
  const cache = ctx.runtimeState?.build?.output?.emittedSource
  if (!ctx.configService?.isDev || !cache) {
    return
  }

  const isHmrBuild = ctx.runtimeState?.build?.hmr?.profile?.event !== undefined
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  rewriteWevuInternalRuntimeImports(bundle, rewriteOptions)
  stabilizeWevuRuntimeChunkAccess(bundle)
  pruneUneventedDevHmrChunks(ctx, bundle)
  for (const [fileName, output] of Object.entries(bundle)) {
    const source = outputSourceToString(output)
    const shouldForceEmitCurrentHmrChunk = isHmrBuild
      && output.type === 'chunk'
      && (
        emittedChunkFileNames?.has(fileName) === true
        || emittedChunkFileNames?.has(output.fileName) === true
      )
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
      pruneUnchangedDevHmrOutputs(ctx, bundle as unknown as OutputBundle, wevuRuntimeRewriteOptions)
    },
  }
}
