import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { WxmlDependencyCommit } from '../../wxml/processing/dependencies'
import type { RewriteWevuInternalRuntimeImportsOptions } from '../core/helpers/bundle'
import { Buffer } from 'node:buffer'
import path from 'pathe'
import { createHmrProfileCheckpoint } from '../../utils/hmrProfile'
import { syncOutputChunkSourceMapAssets } from '../../utils/outputChunk'
import { commitWxmlDependencies, failWxmlDependencies } from '../../wxml/processing/dependencies'
import { validateWxmlBundle } from '../../wxml/validate'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from '../core/helpers/bundle'
import { resolveRootEntryBasename } from '../core/lifecycle/load/weapi'
import { collectIndependentOutputFileNames, flushIndependentOutputs } from './independent'
import { prepareOutputOwnership } from './ownership'

function outputSourceToString(output: OutputBundle[string]) {
  if (output.type === 'chunk') {
    return output.code
  }

  const source = output.source
  return typeof source === 'string'
    ? source
    : Buffer.from(source).toString('base64')
}

export function pruneUneventedDevHmrChunks(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  const emittedChunkFileNames = ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (
    !ctx.configService?.isDev
    || ctx.runtimeState?.build?.hmr?.isRebuild !== true
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
    preserveCompleteBundle?: boolean
  },
) {
  const cache = ctx.runtimeState?.build?.output?.emittedSource
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
    const isCurrentHmrChunk = isHmrBuild
      && output.type === 'chunk'
      && (
        emittedChunkFileNames?.has(fileName) === true
        || emittedChunkFileNames?.has(output.fileName) === true
      )
    const shouldForceEmitCurrentHmrChunk = isCurrentHmrChunk
      && ctx.runtimeState.build.hmr.forceEmitUnchangedChunks !== false
    if (
      isHmrBuild
      && output.type === 'chunk'
      && emittedChunkFileNames?.size
      && !isCurrentHmrChunk
      && !isRootInput
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

/** 编译器完成所有输出转换后，按最终内容裁剪本轮写入。 */
export function createOutputPublicationPlugin(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin {
  let preserveCompleteBundle = false
  let outDir: string | undefined
  let commitOwnership: (() => Promise<void>) | undefined
  return {
    name: 'weapp-vite:output-publication',
    enforce: 'post',
    configResolved(config) {
      // 原生引擎仍发布完整注册图，静态资源去重由 stateful 快照归属处理。
      preserveCompleteBundle = config.experimental?.bundledDev === true
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        await commitOwnership?.()
        commitOwnership = undefined
      },
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        commitOwnership = undefined
        const checkpoint = createHmrProfileCheckpoint(ctx.configService.isDev ? ctx.runtimeState?.build?.hmr?.profile : undefined)
        const outputBundle = bundle as unknown as OutputBundle
        const partial = ctx.configService.isDev && !preserveCompleteBundle
          && ctx.runtimeState?.build?.hmr?.didEmitAllEntries !== true
          && ctx.runtimeState?.build?.hmr?.isRebuild === true
        let commitValidation: WxmlDependencyCommit | undefined
        try {
          commitValidation = await validateWxmlBundle(ctx, outputBundle, {
            warn: message => this.warn(message),
            addWatchFile: file => this.addWatchFile?.(file),
            partial,
          }, subPackageMeta?.subPackage.root)
          checkpoint('publicationValidateMs')
          // 先等待独立分包成功，失败时不能提前推进主包的 HMR 指纹。
          // 子产物已完成自身校验与裁剪，在主包内不重复处理。
          const independentAssets: EmittedAsset[] = []
          try {
            await flushIndependentOutputs(ctx, subPackageMeta, asset => independentAssets.push(asset))
          }
          finally {
            // 子构建没有活动 watcher；主发布者接管其精确依赖，失败时也保留恢复监听。
            if ((ctx.configService.isDev || this.meta.watchMode) && !subPackageMeta) {
              for (const files of ctx.runtimeState?.build?.independent?.watchFiles.values() ?? []) {
                for (const file of files) {
                  this.addWatchFile(file)
                }
              }
            }
          }
          checkpoint('publicationIndependentMs')
          if ((ctx.configService.isDev || this.meta.watchMode) && !preserveCompleteBundle && outDir) {
            // 在后续裁剪与 emitFile 改写 bundle 前冻结本轮主包输出集合；所有权提交只应延迟到 writeBundle。
            const outputNames = Object.keys(outputBundle)
            const independentOutputNames = collectIndependentOutputFileNames(ctx)
            commitOwnership = async () => {
              await prepareOutputOwnership(ctx, outDir!, outputNames, partial)()
              await prepareOutputOwnership(ctx, outDir!, independentOutputNames, false, [], 'independent')()
            }
          }
          pruneUnchangedDevHmrOutputs(ctx, outputBundle, undefined, {
            runtimeRewriteDone: true,
            preserveCompleteBundle,
          })
          syncOutputChunkSourceMapAssets(outputBundle)
          for (const asset of independentAssets) {
            this.emitFile(asset)
          }
          commitWxmlDependencies(ctx)
          commitValidation?.()
          checkpoint('publicationPruneMs')
        }
        catch (error) {
          failWxmlDependencies(ctx)
          commitValidation?.fail()
          throw error
        }
      },
    },
  }
}
