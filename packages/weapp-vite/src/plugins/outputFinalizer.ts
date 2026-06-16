import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { Buffer } from 'node:buffer'
import { changeFileExtension } from '../utils'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i
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
) {
  const cache = ctx.runtimeState?.build?.output?.emittedSource
  if (!ctx.configService?.isDev || !cache) {
    return
  }

  const isHmrBuild = ctx.runtimeState?.build?.hmr?.profile?.event !== undefined
  pruneUneventedDevHmrChunks(ctx, bundle)
  for (const [fileName, output] of Object.entries(bundle)) {
    const source = outputSourceToString(output)
    if (isHmrBuild && cache.get(fileName) === source) {
      delete bundle[fileName]
      continue
    }
    cache.set(fileName, source)
  }
}

export function createOutputFinalizerPlugin(ctx: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:output-finalizer',
    enforce: 'post',
    generateBundle(_options, bundle) {
      normalizePreprocessorStyleAssets(
        bundle as unknown as OutputBundle,
        ctx.configService.outputExtensions?.wxss,
        asset => this.emitFile(asset),
      )
      pruneUnchangedDevHmrOutputs(ctx, bundle as unknown as OutputBundle)
    },
  }
}
