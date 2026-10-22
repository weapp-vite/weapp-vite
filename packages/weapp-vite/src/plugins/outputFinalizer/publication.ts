import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { WxmlDependencyCommit } from '../../wxml/processing/dependencies'
import type { NativeOutputPublicationApi, OutputPublicationScope } from './publicationObservation'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import path from 'pathe'
import { createHmrProfileCheckpoint } from '../../utils/hmrProfile'
import { syncOutputChunkSourceMapAssets } from '../../utils/outputChunk'
import { commitWxmlDependencies, failWxmlDependencies } from '../../wxml/processing/dependencies'
import { validateWxmlBundle } from '../../wxml/validate'
import { createPublicAssetPublication } from '../asset/publication'
import { prepareClassicOutputGeneration, shouldPublishClassicGeneration } from './classicGeneration'
import { pruneUnchangedDevHmrOutputs } from './hmrPrune'
import { captureIndependentOutputAssets, captureIndependentOutputFileNames, flushIndependentOutputs } from './independent'
import { prepareOutputPublicationOwnership } from './ownership'
import { createNativePublicationObservation } from './publicationObservation'

export { pruneUnchangedDevHmrOutputs, pruneUneventedDevHmrChunks } from './hmrPrune'

/** 编译器完成所有输出转换后，按最终内容裁剪本轮写入。 */
export function createOutputPublicationPlugin(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<NativeOutputPublicationApi> {
  type PublicAssets = ReturnType<typeof createPublicAssetPublication>
  const scopes = new Map<string, OutputPublicationScope>()
  let preserveCompleteBundle = false
  let outDir: string | undefined
  let resolvedConfig: Parameters<PublicAssets['configure']>[0]
  let publicConfig: Parameters<PublicAssets['configure']>[0]
  let environmentConfig: Parameters<PublicAssets['start']>[0]
  let nativeWrite = false
  let building = false
  let epoch = 0
  let closing = false
  const writes = new Set<Promise<void>>()

  function releasePendingOwnership() {
    epoch++
    for (const scope of scopes.values()) {
      scope.pending = undefined
      scope.observation.invalidate()
    }
  }
  function outputRoot(options?: { dir?: string }) {
    return options?.dir ? path.resolve(resolvedConfig.root, options.dir) : outDir
  }
  function outputScope(root: string) {
    let scope = scopes.get(root)
    if (!scope) {
      const publicAssets = subPackageMeta ? undefined : createPublicAssetPublication(ctx)
      publicAssets?.configure(root === outDir ? resolvedConfig : { ...publicConfig, build: { ...publicConfig.build, outDir: root } })
      const cache = root === outDir ? ctx.runtimeState?.build?.output?.emittedSource : new Map<string, string>()
      scope = { publicAssets, cache, observation: createNativePublicationObservation(root, cache) }
      scopes.set(root, scope)
      if (building) {
        publicAssets?.start(environmentConfig)
      }
    }
    return scope
  }
  async function closePublications(releaseScopes: boolean) {
    closing = true
    building = false
    environmentConfig = undefined
    for (const scope of scopes.values()) {
      scope.pending = undefined
      scope.observation.invalidate()
    }
    const results = await Promise.allSettled([...writes])
    releasePendingOwnership()
    // closeBundle 也会结束每轮 snapshot，后续 partial 仍需要成功发布的 public 归属账本。
    if (releaseScopes) {
      scopes.clear()
    }
    closing = false
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (errors.length) {
      throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Output publication cleanup failed')
    }
  }
  return {
    name: WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME,
    enforce: 'post',
    api: Object.freeze({
      getEpoch: () => epoch,
      readCommitted: (root: string, expectedEpoch: number) => !closing && expectedEpoch === epoch ? scopes.get(root)?.observation.readCommitted(expectedEpoch) : undefined,
      whenCommitted: (root: string, expectedEpoch: number) => !closing && expectedEpoch === epoch
        ? scopes.get(root)?.observation.whenCommitted(expectedEpoch) ?? Promise.resolve(undefined)
        : Promise.resolve(undefined),
    }),
    configResolved(config) {
      const previousOutDir = outDir
      const resumesNativePublication = preserveCompleteBundle && config.experimental?.bundledDev !== true
      building = false
      environmentConfig = undefined
      // 原生引擎仍发布完整注册图，静态资源去重由 stateful 快照归属处理。
      preserveCompleteBundle = config.experimental?.bundledDev === true
      nativeWrite = config.build.write !== false
      resolvedConfig = config
      // start 会关闭 bundler 自带 public 复制；其他 output 仍须继承原始用户策略。
      publicConfig = { ...config, build: { ...config.build } }
      outDir = path.resolve(config.root, config.build.outDir)
      releasePendingOwnership()
      for (const [root, scope] of scopes) {
        if (root === outDir) {
          scope.publicAssets?.configure(config)
          if (!nativeWrite || preserveCompleteBundle || resumesNativePublication) {
            scope.observation.reset()
          }
        }
        else {
          scopes.delete(root)
        }
      }
      if (previousOutDir && (previousOutDir !== outDir || resumesNativePublication)) {
        // 新目录尚未写入；bundled 快照缓存也不证明 classic 已完成原生发布。
        ctx.runtimeState?.build?.output?.emittedSource.clear()
      }
      outputScope(outDir)
    },
    buildStart() {
      releasePendingOwnership()
      building = true
      environmentConfig = this.environment?.config
      for (const scope of scopes.values()) {
        scope.publicAssets?.start(environmentConfig)
      }
    },
    buildEnd(error) {
      if (error) {
        releasePendingOwnership()
      }
    },
    renderError: releasePendingOwnership,
    closeBundle: () => closePublications(false),
    closeWatcher: () => closePublications(true),
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler(options, bundle = {}) {
        const root = outputRoot(options)
        const scope = root ? scopes.get(root) : undefined
        const pending = scope?.pending
        if (scope) {
          scope.pending = undefined
        }
        if (!pending || closing) {
          return
        }
        const write = async () => {
          await scope?.publicAssets?.commit()
          if (pending.ownership) {
            await pending.ownership()
          }
          if (pending.epoch !== epoch) {
            return
          }
          if (!pending.partial) {
            const retained = new Set(pending.outputNames)
            for (const file of scope?.cache?.keys() ?? []) {
              if (!retained.has(file)) {
                scope?.cache?.delete(file)
              }
            }
          }
          for (const [file, source] of pending.sources ?? []) {
            scope?.cache?.set(file, source)
          }
          pending.generation?.()
          scope?.observation.commit(pending.epoch, bundle as unknown as OutputBundle, pending.observedAssets)
        }
        const task = write()
        writes.add(task)
        try {
          await task
        }
        catch (error) {
          scope?.observation.invalidate()
          throw error
        }
        finally {
          writes.delete(task)
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler(options, bundle, isWrite) {
        const root = outputRoot(options)
        const scope = root ? outputScope(root) : undefined
        if (scope) {
          scope.pending = undefined
          scope.observation.invalidate()
        }
        const publicationEpoch = epoch
        const assertActive = () => {
          if (closing || publicationEpoch !== epoch) {
            throw new Error('[weapp-vite] 原生发布会话已关闭，停止旧代输出。')
          }
        }
        assertActive()
        const checkpoint = createHmrProfileCheckpoint(ctx.configService.isDev ? ctx.runtimeState?.build?.hmr?.profile : undefined)
        const outputBundle = bundle as unknown as OutputBundle
        const partial = ctx.configService.isDev && !preserveCompleteBundle
          && ctx.runtimeState?.build?.hmr?.didEmitAllEntries !== true
          && ctx.runtimeState?.build?.hmr?.isRebuild === true
        const independentOutputNames = new Set(captureIndependentOutputFileNames(ctx))
        const independentSnapshot = captureIndependentOutputAssets(ctx)
        let commitValidation: WxmlDependencyCommit | undefined
        try {
          commitValidation = await validateWxmlBundle(ctx, outputBundle, {
            warn: message => this.warn(message),
            addWatchFile: file => this.addWatchFile?.(file),
            partial,
          }, subPackageMeta?.subPackage.root)
          checkpoint('publicationValidateMs')
          assertActive()
          // 先等待独立分包成功，失败时不能提前推进主包的 HMR 指纹。
          // 子产物已完成自身校验与裁剪，在主包内不重复处理。
          const independentAssets: EmittedAsset[] = []
          try {
            await flushIndependentOutputs(ctx, subPackageMeta, (asset) => {
              independentAssets.push(asset)
              if (asset.fileName) {
                independentOutputNames.add(asset.fileName)
              }
            })
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
          assertActive()
          // 在后续裁剪与 emitFile 改写 bundle 前冻结编译输出集合，public 使用同一份归属排除碰撞。
          const outputNames = Object.keys(outputBundle)
          const publicOutputs: EmittedAsset[] = []
          await scope?.publicAssets?.emit([...outputNames, ...independentOutputNames], partial, asset => publicOutputs.push(asset))
          assertActive()
          const generation = isWrite && nativeWrite && !preserveCompleteBundle && !subPackageMeta && root
            && shouldPublishClassicGeneration(ctx)
            ? prepareClassicOutputGeneration(ctx, root, outputBundle, {
                partial,
                independentOutputs: [...independentSnapshot, ...independentAssets],
                independentOutputNames,
                publicOutputs,
              })
            : undefined
          // 原生写入失败后必须重放同一字节，不能让 generate 阶段提前推进已发布指纹。
          const stagedSources = ctx.configService.isDev && isWrite && nativeWrite && !preserveCompleteBundle && scope?.cache
            ? new Map(scope.cache)
            : undefined
          syncOutputChunkSourceMapAssets(outputBundle)
          pruneUnchangedDevHmrOutputs(ctx, outputBundle, undefined, {
            runtimeRewriteDone: true,
            preserveCompleteBundle,
            emittedSource: stagedSources,
          })
          const sources = stagedSources
            ? new Map(Object.keys(outputBundle).map(file => [file, stagedSources.get(file)!]))
            : undefined
          for (const asset of independentAssets) {
            this.emitFile(asset)
          }
          const publicOutputNames: string[] = []
          for (const asset of publicOutputs) {
            if (asset.fileName) {
              publicOutputNames.push(asset.fileName)
            }
            this.emitFile(asset)
          }
          if (isWrite && nativeWrite && (ctx.configService.isDev || this.meta.watchMode) && !preserveCompleteBundle && root && scope && publicationEpoch === epoch) {
            // 独立 helper 仅冻结普通归属数据与命令身份，不保留 generateBundle 的插件上下文。
            const ownership = prepareOutputPublicationOwnership(ctx, root, {
              outputNames,
              independentOutputNames: [...independentOutputNames],
              publicOutputNames,
              partial,
              retireStateful: !partial && !subPackageMeta && (ctx.currentBuildTarget ?? 'app') === 'app',
            })
            scope.pending = { epoch: publicationEpoch, ownership, generation, sources, outputNames, partial, observedAssets: [...independentSnapshot, ...independentAssets, ...publicOutputs] }
          }
          commitWxmlDependencies(ctx)
          commitValidation?.()
          checkpoint('publicationPruneMs')
        }
        catch (error) {
          if (scope) {
            scope.pending = undefined
            scope.observation.invalidate()
          }
          failWxmlDependencies(ctx)
          commitValidation?.fail()
          throw error
        }
      },
    },
  }
}
