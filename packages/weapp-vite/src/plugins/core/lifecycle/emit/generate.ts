import type { OutputBundle, OutputChunk } from 'rolldown'
import type { RuntimeChunkDuplicatePayload, SharedChunkDuplicatePayload } from '../../../../runtime/chunkStrategy'
import type { SubPackageMetaValue } from '../../../../types'
import type { CorePluginState } from '../../helpers'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { shouldRewriteBundleNpmImports } from '../../../../platform'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../../../../runtime/chunkStrategy'
import { resolveRequestRuntimeOptions } from '../../../../runtime/config/internal/injectRequestGlobals'
import { resolveNpmBuildCandidateDependencyRecordSync } from '../../../../runtime/npmPlugin/service'
import { toPosixPath } from '../../../../utils'
import {
  filterPluginBundleOutputs,
  flushIndependentBuilds,
  formatBytes,
  refreshModuleGraph,
  refreshPartialSharedChunkImporters,
  refreshSharedChunkImporters,
  removeImplicitPagePreloads,
} from '../../helpers'
import { injectAppPreludeCode, resolveAppPreludeCode, resolveAppPreludeOptions } from './appPrelude'
import { PRETTY_NODE_MODULES_RE } from './constants'
import {
  injectAxiosFetchAdapterEnv,
  injectRequestGlobalsBundleRuntime,
  injectRequestGlobalsLocalBindings,
  injectRequestGlobalsPassiveBindings,
} from './requestGlobals'
import {
  rewriteBundleDynamicGlobalResolution,
  rewriteBundleNpmImportsByPlatform,
  rewriteBundlePlatformApi,
  rewriteChunkNpmImportsToLocalRoot,
  rewriteJsonNpmImportsToLocalRoot,
} from './rewrite'

function resolveInjectWeapiGlobalName(state: CorePluginState) {
  const injectWeapi = state.ctx.configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }
  const enabled = typeof injectWeapi === 'object' ? injectWeapi.enabled === true : injectWeapi === true
  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }
  return injectWeapi.globalName?.trim() || 'wpi'
}

export function createGenerateBundleHook(state: CorePluginState, isPluginBuild: boolean) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    webRuntime: configService.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))
  const npmBuildCandidateDependencies = resolveNpmBuildCandidateDependencyRecordSync(ctx, configService.packageJson)

  return async function generateBundle(this: any, _options: any, bundle: any) {
    const rolldownBundle = bundle as unknown as OutputBundle
    await flushIndependentBuilds.call(this, state)

    if (isPluginBuild) {
      filterPluginBundleOutputs(rolldownBundle, configService)
      if (!shouldRewriteBundleNpmImports(configService.platform)) {
        for (const output of Object.values(rolldownBundle)) {
          if (output?.type === 'chunk') {
            rewriteChunkNpmImportsToLocalRoot(output as OutputChunk, '', undefined, npmBuildCandidateDependencies, {
              astEngine,
              basedir: configService.cwd,
            })
          }
        }
        rewriteJsonNpmImportsToLocalRoot(rolldownBundle, '', undefined, npmBuildCandidateDependencies, configService.cwd)
      }
      return
    }

    if (!subPackageMeta) {
      const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
      const shouldLogChunks = configService.weappViteConfig?.chunks?.logOptimization ?? true
      const subPackageRoots = [...scanService.subPackageMap.keys()].filter(Boolean)
      const duplicateWarningBytes = Number(configService.weappViteConfig?.chunks?.duplicateWarningBytes ?? 0)
      const shouldWarnOnDuplicate = Number.isFinite(duplicateWarningBytes) && duplicateWarningBytes > 0
      let redundantBytesTotal = 0

      if (configService.isDev && state.hmrSharedChunksMode === 'auto') {
        if (state.hmrState.didEmitAllEntries || !state.hmrState.hasBuiltOnce) {
          refreshSharedChunkImporters(rolldownBundle, state)
        }
        else if (state.hmrState.lastEmittedEntryIds?.size) {
          refreshPartialSharedChunkImporters(rolldownBundle, state, state.hmrState.lastEmittedEntryIds)
        }
        state.hmrState.hasBuiltOnce = true
      }

      function matchSubPackage(filePath: string) {
        return subPackageRoots.find(root => filePath === root || filePath.startsWith(`${root}/`))
      }

      const resolveSharedChunkLabel = (sharedFileName: string, finalFileName: string) => {
        const prettifyModuleLabel = (label: string) => {
          const normalized = toPosixPath(label)
          const match = normalized.match(PRETTY_NODE_MODULES_RE)
          return match?.[1] || label
        }
        const candidates: OutputChunk[] = []
        const collect = (output?: OutputBundle[string]) => {
          if (output?.type === 'chunk') {
            candidates.push(output as OutputChunk)
          }
        }
        collect(rolldownBundle[sharedFileName])
        if (finalFileName !== sharedFileName) {
          collect(rolldownBundle[finalFileName])
        }
        if (!candidates.length) {
          const matched = Object.values(rolldownBundle).find(
            (output): output is OutputChunk => output?.type === 'chunk'
              && (((output as OutputChunk).fileName ?? '') === finalFileName || ((output as OutputChunk).fileName ?? '') === sharedFileName),
          )
          if (matched) {
            candidates.push(matched)
          }
        }
        const chunk = candidates[0]
        if (!chunk) {
          return finalFileName
        }
        const moduleLabels = [...new Set(
          Object.keys(chunk.modules ?? {})
            .filter(id => id && !id.startsWith('\0'))
            .map(id => configService.relativeAbsoluteSrcRoot(id))
            .filter(Boolean),
        )]
        if (!moduleLabels.length) {
          return chunk.fileName || finalFileName
        }
        const preview = moduleLabels.map(prettifyModuleLabel).slice(0, 3)
        const remaining = moduleLabels.length - preview.length
        const suffix = remaining > 0 ? ` 等 ${moduleLabels.length} 个模块` : ''
        return `${preview.join('、')}${suffix}`
      }

      const runtimeLocalizationRoots = new Set<string>()
      const handleDuplicate = ({
        duplicates,
        ignoredMainImporters,
        chunkBytes,
        redundantBytes,
        retainedInMain,
        sharedFileName,
        requiresRuntimeLocalization,
      }: SharedChunkDuplicatePayload) => {
        if (shouldWarnOnDuplicate) {
          const duplicateCount = duplicates.length
          const computedRedundant = typeof redundantBytes === 'number'
            ? redundantBytes
            : typeof chunkBytes === 'number'
              ? chunkBytes * Math.max(duplicateCount - 1, 0)
              : 0
          redundantBytesTotal += computedRedundant
        }
        if (requiresRuntimeLocalization) {
          for (const { fileName } of duplicates) {
            const match = matchSubPackage(fileName)
            if (match) {
              runtimeLocalizationRoots.add(match)
            }
          }
        }
        if (!shouldLogChunks) {
          return
        }
        const subPackageSet = new Set<string>()
        let totalReferences = 0
        for (const { fileName, importers } of duplicates) {
          totalReferences += importers.length
          const match = matchSubPackage(fileName)
          if (match) {
            subPackageSet.add(match)
          }
        }
        const subPackageList = [...subPackageSet].join('、') || '相关分包'
        const ignoredHint = ignoredMainImporters?.length ? `，忽略主包引用：${ignoredMainImporters.join('、')}` : ''
        logger.info(`[分包] 分包 ${subPackageList} 共享模块已复制到各自 weapp-shared/common.js（${totalReferences} 处引用${ignoredHint}）`)
        if (retainedInMain) {
          logger.warn(`[分包] 模块 ${sharedFileName} 同时被主包引用，因此仍保留在主包 common.js，并复制到 ${subPackageList}，请确认是否需要将源代码移动到主包或公共目录。`)
        }
      }

      applySharedChunkStrategy.call(this, rolldownBundle, {
        strategy: sharedStrategy,
        subPackageRoots,
        onDuplicate: handleDuplicate,
        onFallback: shouldLogChunks
          ? ({ reason, importers, sharedFileName, finalFileName }) => {
              const involvedSubs = new Set<string>()
              let hasMainReference = false
              for (const importer of importers) {
                const match = matchSubPackage(importer)
                if (match) {
                  involvedSubs.add(match)
                }
                else {
                  hasMainReference = true
                }
              }
              const segments: string[] = []
              if (involvedSubs.size) {
                segments.push(`分包 ${[...involvedSubs].join('、')}`)
              }
              if (hasMainReference) {
                segments.push('主包')
              }
              const scope = segments.join('、') || '主包'
              const sharedChunkLabel = resolveSharedChunkLabel(sharedFileName, finalFileName)
              if (reason === 'main-package') {
                logger.info(`[分包] ${scope} 共享模块 ${sharedChunkLabel}（${importers.length} 处引用）已提升到主包 common.js`)
              }
              else {
                logger.info(`[分包] 仅主包使用共享模块 ${sharedChunkLabel}（${importers.length} 处引用），保留在主包 common.js`)
              }
            }
          : undefined,
      })

      applyRuntimeChunkLocalization.call(this, rolldownBundle, {
        subPackageRoots,
        forceRoots: runtimeLocalizationRoots,
        onDuplicate: shouldLogChunks
          ? ({ duplicates, runtimeFileName }: RuntimeChunkDuplicatePayload) => {
              const subPackageSet = new Set<string>()
              for (const { fileName } of duplicates) {
                const match = matchSubPackage(fileName)
                if (match) {
                  subPackageSet.add(match)
                }
              }
              const subPackageList = [...subPackageSet].join('、') || '相关分包'
              logger.info(`[分包] 分包 ${subPackageList} 已本地化 ${runtimeFileName} 依赖，避免跨包 runtime 引用。`)
            }
          : undefined,
      })

      if (shouldWarnOnDuplicate && redundantBytesTotal > duplicateWarningBytes) {
        logger.warn(`[分包] 分包复制共享模块产生冗余体积 ${formatBytes(redundantBytesTotal)}，已超过阈值 ${formatBytes(duplicateWarningBytes)}，建议调整分包划分或运行 weapp-vite analyze 定位问题。`)
      }
    }

    removeImplicitPagePreloads(rolldownBundle, {
      configService,
      entriesMap: state.entriesMap,
    })

    if (shouldRewriteBundleNpmImports(configService.platform)) {
      rewriteBundleNpmImportsByPlatform(
        configService.platform,
        rolldownBundle,
        npmBuildCandidateDependencies,
        configService.weappViteConfig?.npm?.alipayNpmMode,
        { astEngine },
      )
    }
    else {
      const subPackageMap = scanService.subPackageMap ?? new Map<string, SubPackageMetaValue>()
      const localSubPackageMetas = [...subPackageMap.values()]
        .filter(meta => Array.isArray(meta?.subPackage?.dependencies) && meta.subPackage.dependencies.length > 0)
      const localSubPackageRoots = localSubPackageMetas
        .map(meta => meta.subPackage.root)
        .filter(Boolean)

      for (const output of Object.values(rolldownBundle)) {
        if (output?.type !== 'chunk') {
          continue
        }
        if (localSubPackageRoots.some(root => output.fileName === root || output.fileName.startsWith(`${root}/`))) {
          continue
        }
        rewriteChunkNpmImportsToLocalRoot(output as OutputChunk, '', undefined, npmBuildCandidateDependencies, {
          astEngine,
          basedir: configService.cwd,
        })
      }
      rewriteJsonNpmImportsToLocalRoot(rolldownBundle, '', undefined, npmBuildCandidateDependencies, configService.cwd, {
        excludeRoots: localSubPackageRoots,
      })

      for (const meta of localSubPackageMetas) {
        for (const output of Object.values(rolldownBundle)) {
          if (output?.type !== 'chunk') {
            continue
          }
          const chunk = output as OutputChunk
          if (chunk.fileName === meta.subPackage.root || !chunk.fileName.startsWith(`${meta.subPackage.root}/`)) {
            continue
          }
          rewriteChunkNpmImportsToLocalRoot(chunk, meta.subPackage.root, meta.subPackage.dependencies, npmBuildCandidateDependencies, {
            astEngine,
            basedir: configService.cwd,
          })
        }
        rewriteJsonNpmImportsToLocalRoot(rolldownBundle, meta.subPackage.root, meta.subPackage.dependencies, npmBuildCandidateDependencies, configService.cwd)
      }
    }

    const injectWeapiGlobalName = resolveInjectWeapiGlobalName(state)
    if (injectWeapiGlobalName) {
      rewriteBundlePlatformApi(rolldownBundle, injectWeapiGlobalName, { astEngine })
    }
    rewriteBundleDynamicGlobalResolution(rolldownBundle)

    const installerChunks = injectRequestGlobalsOptions?.targets?.length
      ? injectRequestGlobalsBundleRuntime(
          rolldownBundle,
          injectRequestGlobalsOptions.targets,
          injectRequestGlobalsOptions.mode,
          injectRequestGlobalsOptions.networkDefaults,
        )
      : new Map<string, string>()
    if (injectRequestGlobalsOptions?.targets?.length) {
      injectRequestGlobalsPassiveBindings(rolldownBundle, installerChunks, injectRequestGlobalsOptions.targets, injectRequestGlobalsOptions.mode, state.entriesMap)
      injectRequestGlobalsLocalBindings(
        rolldownBundle,
        installerChunks,
        injectRequestGlobalsOptions.targets,
        injectRequestGlobalsOptions.mode,
        state.entriesMap,
        injectRequestGlobalsOptions.networkDefaults,
      )
      injectAxiosFetchAdapterEnv(rolldownBundle)
    }

    const appPreludeOptions = resolveAppPreludeOptions(state)
    const appPreludeCode = await resolveAppPreludeCode(scanService.appEntry?.preludePath, {
      defineImportMetaEnv: configService.defineImportMetaEnv,
      relativePath: scanService.appEntry?.preludePath
        ? configService.relativeAbsoluteSrcRoot(scanService.appEntry.preludePath)
        : undefined,
    })
    injectAppPreludeCode(
      rolldownBundle,
      appPreludeCode,
      {
        ...appPreludeOptions,
        enabled: appPreludeOptions.enabled || injectRequestGlobalsOptions?.prelude === true,
      },
      state,
      {
        enabled: injectRequestGlobalsOptions?.prelude === true,
        installerChunks,
        mode: injectRequestGlobalsOptions?.mode ?? 'explicit',
        networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
        targets: injectRequestGlobalsOptions?.targets ?? [],
      },
      asset => this.emitFile(asset),
    )

    refreshModuleGraph(this, state)

    if (configService.weappViteConfig?.debug?.watchFiles) {
      const watcherService = ctx.watcherService
      const watcherRoot = subPackageMeta?.subPackage.root ?? '/'
      const watcher = watcherService?.getRollupWatcher(watcherRoot)
      let watchFiles: string[] | undefined
      if (watcher && typeof (watcher as any).getWatchFiles === 'function') {
        watchFiles = await (watcher as any).getWatchFiles()
      }
      else if (state.watchFilesSnapshot.length) {
        watchFiles = state.watchFilesSnapshot
      }
      if (watchFiles && watchFiles.length) {
        configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
      }
      state.watchFilesSnapshot = []
    }
  }
}
