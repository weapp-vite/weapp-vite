import type { OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin } from 'vite'
import type { SharedChunkDuplicatePayload } from '../../runtime/chunkStrategy'
import type { ChangeEvent, SubPackageMetaValue } from '../../types'
import type { WxmlEmitRuntime } from '../utils/wxmlEmit'
import type { CorePluginState, IndependentBuildResult } from './helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../constants'
import { createDebugger } from '../../debugger'
import logger from '../../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY, resetTakeImportRegistry } from '../../runtime/chunkStrategy'
import { isCSSRequest, toPosixPath } from '../../utils'
import { findJsEntry, isTemplate } from '../../utils/file'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'
import { invalidateSharedStyleCache } from '../css/shared/preprocessor'
import { invalidateFileCache, readFile as readFileCached } from '../utils/cache'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from '../utils/invalidateEntry'
import { getCssRealPath, parseRequest } from '../utils/parse'
import { emitWxmlAssetsWithCache } from '../utils/wxmlEmit'
import {
  collectAffectedEntries,
  emitJsonAssets,
  filterPluginBundleOutputs,
  flushIndependentBuilds,
  formatBytes,
  refreshModuleGraph,
  refreshSharedChunkImporters,
  removeImplicitPagePreloads,
} from './helpers'

const debug = createDebugger('weapp-vite:core')
const configSuffixes = configExtensions.map(ext => `.${ext}`)
const styleSuffixes = supportedCssLangs.map(ext => `.${ext}`)

export function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, markEntryDirty, emitDirtyEntries, buildTarget } = state
  const { scanService, configService, buildService } = ctx
  const isPluginBuild = buildTarget === 'plugin'

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',

    async buildStart() {
      resetTakeImportRegistry()
      if (configService.isDev) {
        if (isPluginBuild) {
          if (configService.absolutePluginRoot) {
            ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
          }
        }
        else {
          const rootDir = subPackageMeta
            ? path.resolve(configService.absoluteSrcRoot, subPackageMeta.subPackage.root)
            : configService.absoluteSrcRoot
          ensureSidecarWatcher(ctx, rootDir)
          if (!subPackageMeta && configService.absolutePluginRoot) {
            ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
          }
        }
      }
      await emitDirtyEntries.call(this)
    },

    async watchChange(id: string, change: { event: ChangeEvent }) {
      const normalizedId = normalizeFsResolvedId(id)
      if (isSkippableResolvedId(normalizedId)) {
        return
      }
      invalidateFileCache(normalizedId)
      if (change.event === 'update') {
        const isTemplateFile = isTemplate(normalizedId)
        const configSuffix = configSuffixes.find(suffix => normalizedId.endsWith(suffix))
        const isStyleFile = styleSuffixes.some(suffix => normalizedId.endsWith(suffix))

        if (isTemplateFile) {
          const wxmlService = ctx.wxmlService
          if (wxmlService) {
            await wxmlService.scan(normalizedId)
          }
        }

        if (isTemplateFile || configSuffix || isStyleFile) {
          const basePath = configSuffix
            ? normalizedId.slice(0, -configSuffix.length)
            : (() => {
                const ext = path.extname(normalizedId)
                return ext ? normalizedId.slice(0, -ext.length) : normalizedId
              })()
          const primaryScript = await findJsEntry(basePath)
          if (primaryScript.path) {
            markEntryDirty(normalizeFsResolvedId(primaryScript.path))
          }
        }
      }
      if (loadedEntrySet.has(normalizedId)) {
        markEntryDirty(normalizedId)
      }
      else if (state.moduleImporters.size && state.entryModuleIds.size) {
        const affected = collectAffectedEntries(state, normalizedId)
        if (affected.size) {
          for (const entryId of affected) {
            markEntryDirty(entryId)
          }
        }
      }
      const relativeSrc = configService.relativeAbsoluteSrcRoot(normalizedId)
      const relativeCwd = configService.relativeCwd(normalizedId)
      let handledByIndependentWatcher = false
      let independentMeta: SubPackageMetaValue | undefined

      if (change.event === 'create' || change.event === 'delete') {
        ;(loadEntry as any)?.invalidateResolveCache?.()
        await invalidateEntryForSidecar(ctx, normalizedId, change.event)
      }

      if (!subPackageMeta) {
        if (relativeSrc === 'app.json' || relativeCwd === 'project.config.json' || relativeCwd === 'project.private.config.json') {
          scanService.markDirty()
        }

        const independentRoot = Array.from(scanService.independentSubPackageMap.keys()).find((root) => {
          return relativeSrc.startsWith(`${root}/`)
        })

        if (independentRoot) {
          independentMeta = scanService.independentSubPackageMap.get(independentRoot)
          buildService.invalidateIndependentOutput(independentRoot)
          scanService.markIndependentDirty(independentRoot)
          handledByIndependentWatcher = true
          if (independentMeta?.watchSharedStyles !== false) {
            invalidateSharedStyleCache()
          }
        }
      }

      if (subPackageMeta) {
        if (subPackageMeta.watchSharedStyles !== false) {
          invalidateSharedStyleCache()
        }
        logger.success(`[${change.event}] ${configService.relativeCwd(normalizedId)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
      }
      else if (!handledByIndependentWatcher) {
        logger.success(`[${change.event}] ${configService.relativeCwd(normalizedId)}`)
      }
    },

    async options(options) {
      state.pendingIndependentBuilds = []
      let scannedInput: Record<string, string>

      if (subPackageMeta) {
        scannedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, entry) => {
          acc[entry] = path.resolve(configService.absoluteSrcRoot, entry)
          return acc
        }, {})
      }
      else {
        const appEntry = await scanService.loadAppEntry()
        scanService.loadSubPackages()
        const dirtyIndependentRoots = scanService.drainIndependentDirtyRoots()
        const pendingIndependentBuilds: Promise<IndependentBuildResult>[] = []
        for (const root of dirtyIndependentRoots) {
          const meta = scanService.independentSubPackageMap.get(root)
          if (!meta) {
            continue
          }
          const buildTask = buildService.buildIndependentBundle(root, meta).then((rollup) => {
            return {
              meta,
              rollup,
            }
          })
          buildTask.catch(() => {})
          pendingIndependentBuilds.push(buildTask)
        }
        state.pendingIndependentBuilds = pendingIndependentBuilds
        scannedInput = { app: appEntry.path }
      }

      options.input = scannedInput
    },

    async load(id) {
      configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)

      if (isCSSRequest(id)) {
        const parsed = parseRequest(id)
        if (parsed.query.wxss) {
          const realPath = getCssRealPath(parsed)
          this.addWatchFile(realPath)
          try {
            const css = await readFileCached(realPath, { checkMtime: configService.isDev })
            return { code: css }
          }
          catch {}
        }
        return null
      }

      const sourceId = normalizeFsResolvedId(id)
      const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))

      if (loadedEntrySet.has(sourceId) || subPackageMeta?.entries.includes(relativeBasename)) {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, sourceId, 'component')
      }

      if (relativeBasename === 'app') {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, sourceId, 'app')
      }
    },

    renderStart() {
      emitJsonAssets.call(this, state)
      const runtime: WxmlEmitRuntime = {
        addWatchFile: typeof this.addWatchFile === 'function' ? (id: string) => { this.addWatchFile(id) } : undefined,
        emitFile: (asset) => {
          this.emitFile(asset)
        },
      }
      state.watchFilesSnapshot = emitWxmlAssetsWithCache({
        runtime,
        compiler: ctx,
        subPackageMeta,
        emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
        buildTarget,
      })
    },

    async generateBundle(_options, bundle) {
      const rolldownBundle = bundle as unknown as OutputBundle
      await flushIndependentBuilds.call(this, state)

      if (isPluginBuild) {
        filterPluginBundleOutputs(rolldownBundle, configService)
        return
      }

      if (!subPackageMeta) {
        const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
        const shouldLogChunks = configService.weappViteConfig?.chunks?.logOptimization ?? true
        const subPackageRoots = Array.from(scanService.subPackageMap.keys()).filter(Boolean)
        const duplicateWarningBytes = Number(configService.weappViteConfig?.chunks?.duplicateWarningBytes ?? 0)
        const shouldWarnOnDuplicate = Number.isFinite(duplicateWarningBytes) && duplicateWarningBytes > 0
        let redundantBytesTotal = 0

        if (configService.isDev && state.hmrSharedChunksMode === 'auto') {
          if (state.hmrState.didEmitAllEntries || !state.hmrState.hasBuiltOnce) {
            refreshSharedChunkImporters(rolldownBundle, state)
          }
          state.hmrState.hasBuiltOnce = true
        }

        function matchSubPackage(filePath: string) {
          return subPackageRoots.find(root => filePath === root || filePath.startsWith(`${root}/`))
        }

        const resolveSharedChunkLabel = (sharedFileName: string, finalFileName: string) => {
          const prettifyModuleLabel = (label: string) => {
            const normalized = toPosixPath(label)
            const match = normalized.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(.+)/)
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

          const moduleLabels = Array.from(
            new Set(
              Object.keys(chunk.modules ?? {})
                .filter(id => id && !id.startsWith('\0'))
                .map(id => configService.relativeAbsoluteSrcRoot(id))
                .filter(Boolean),
            ),
          )

          if (!moduleLabels.length) {
            return chunk.fileName || finalFileName
          }

          const preview = moduleLabels
            .map(prettifyModuleLabel)
            .slice(0, 3)
          const remaining = moduleLabels.length - preview.length
          const suffix = remaining > 0 ? ` 等 ${moduleLabels.length} 个模块` : ''
          return `${preview.join('、')}${suffix}`
        }

        const handleDuplicate: ((payload: SharedChunkDuplicatePayload) => void) | undefined = shouldLogChunks || shouldWarnOnDuplicate
          ? ({ duplicates, ignoredMainImporters, chunkBytes, redundantBytes, retainedInMain, sharedFileName }) => {
              if (shouldWarnOnDuplicate) {
                const duplicateCount = duplicates.length
                const computedRedundant = typeof redundantBytes === 'number'
                  ? redundantBytes
                  : typeof chunkBytes === 'number'
                    ? chunkBytes * Math.max(duplicateCount - 1, 0)
                    : 0
                redundantBytesTotal += computedRedundant
              }

              if (shouldLogChunks) {
                const subPackageSet = new Set<string>()
                let totalReferences = 0
                for (const { fileName, importers } of duplicates) {
                  totalReferences += importers.length
                  const match = matchSubPackage(fileName)
                  if (match) {
                    subPackageSet.add(match)
                  }
                }
                const subPackageList = Array.from(subPackageSet).join('、') || '相关分包'
                const ignoredHint = ignoredMainImporters?.length
                  ? `，忽略主包引用：${ignoredMainImporters.join('、')}`
                  : ''
                logger.info(`[subpackages] 分包 ${subPackageList} 共享模块已复制到各自 weapp-shared/common.js（${totalReferences} 处引用${ignoredHint}）`)

                if (retainedInMain) {
                  logger.warn(`[subpackages] 模块 ${sharedFileName} 同时被主包引用，因此仍保留在主包 common.js，并复制到 ${subPackageList}，请确认是否需要将源代码移动到主包或公共目录。`)
                }
              }
            }
          : undefined

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
                  segments.push(`分包 ${Array.from(involvedSubs).join('、')}`)
                }
                if (hasMainReference) {
                  segments.push('主包')
                }
                const scope = segments.join('、') || '主包'
                const sharedChunkLabel = resolveSharedChunkLabel(sharedFileName, finalFileName)

                if (reason === 'main-package') {
                  logger.info(`[subpackages] ${scope} 共享模块 ${sharedChunkLabel}（${importers.length} 处引用）已提升到主包 common.js`)
                }
                else {
                  logger.info(`[subpackages] 仅主包使用共享模块 ${sharedChunkLabel}（${importers.length} 处引用），保留在主包 common.js`)
                }
              }
            : undefined,
        })

        if (shouldWarnOnDuplicate && redundantBytesTotal > duplicateWarningBytes) {
          logger.warn(`[subpackages] 分包复制共享模块产生冗余体积 ${formatBytes(redundantBytesTotal)}，已超过阈值 ${formatBytes(duplicateWarningBytes)}，建议调整分包划分或运行 weapp-vite analyze 定位问题。`)
        }
      }

      removeImplicitPagePreloads(rolldownBundle, {
        configService,
        entriesMap: state.entriesMap,
      })

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
    },

    buildEnd() {
      debug?.(`${subPackageMeta ? `独立分包 ${subPackageMeta.subPackage.root}` : '主包'} ${Array.from(this.getModuleIds()).length} 个模块被编译`)
    },
  }
}
