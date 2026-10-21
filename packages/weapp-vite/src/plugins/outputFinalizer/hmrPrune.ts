import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { RewriteWevuInternalRuntimeImportsOptions } from '../core/helpers/bundle'
import { Buffer } from 'node:buffer'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from '../core/helpers/bundle'
import { resolveRootEntryBasename } from '../core/lifecycle/load/weapi'

function outputSourceToString(output: OutputBundle[string]) {
  if (output.type === 'chunk') {
    return output.code
  }
  return typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('base64')
}

export function pruneUneventedDevHmrChunks(ctx: CompilerContext, bundle: OutputBundle) {
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (!ctx.configService?.isDev || ctx.runtimeState?.build?.hmr?.isRebuild !== true || !emittedChunkFileNames?.size) {
    return
  }
  const rootInputFile = `${resolveRootEntryBasename({ ctx })}.js`
  for (const [fileName, output] of Object.entries(bundle)) {
    const isRootInput = output.type === 'chunk' && output.isEntry && fileName === rootInputFile
    if (output.type === 'chunk' && !isRootInput
      && !emittedChunkFileNames.has(fileName) && !emittedChunkFileNames.has(output.fileName)) {
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
    preserveCompleteBundle?: boolean
    emittedSource?: Map<string, string>
  },
) {
  const cache = options?.emittedSource ?? ctx.runtimeState?.build?.output?.emittedSource
  if (!ctx.configService?.isDev || !cache) {
    return
  }
  const isHmrBuild = !options?.preserveCompleteBundle && ctx.runtimeState?.build?.hmr?.isRebuild === true
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (!options?.runtimeRewriteDone) {
    rewriteWevuInternalRuntimeImports(bundle, rewriteOptions)
    stabilizeWevuRuntimeChunkAccess(bundle)
  }
  const rootInputFile = `${resolveRootEntryBasename({ ctx })}.js`
  for (const [fileName, output] of Object.entries(bundle)) {
    // 固定根入口由 bundler input 驱动，不属于动态 emitFile 的页面/组件集合。
    const isRootInput = output.type === 'chunk' && output.isEntry && fileName === rootInputFile
    const isCurrentHmrChunk = isHmrBuild && output.type === 'chunk'
      && (emittedChunkFileNames?.has(fileName) === true || emittedChunkFileNames?.has(output.fileName) === true)
    const force = isCurrentHmrChunk && ctx.runtimeState.build.hmr.forceEmitUnchangedChunks !== false
    if (isHmrBuild && output.type === 'chunk' && emittedChunkFileNames?.size && !isCurrentHmrChunk && !isRootInput) {
      delete bundle[fileName]
      continue
    }
    const source = outputSourceToString(output)
    if (isHmrBuild && !force && cache.get(fileName) === source) {
      delete bundle[fileName]
      continue
    }
    cache.set(fileName, source)
  }
}
