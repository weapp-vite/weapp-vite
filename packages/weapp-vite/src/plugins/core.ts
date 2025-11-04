/* eslint-disable ts/no-use-before-define -- plugin utilities declared later for readability */
import type { RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { SharedChunkDuplicatePayload } from '../runtime/chunkStrategy'
import type { ChangeEvent, SubPackageMetaValue } from '../types'
import type { RequireToken } from './utils/ast'
import type { WxmlEmitRuntime } from './utils/wxmlEmit'
import { isEmptyObject, isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { createDebugger } from '../debugger'
import logger from '../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY, markTakeModuleImporter, resetTakeImportRegistry } from '../runtime/chunkStrategy'
import { isCSSRequest } from '../utils'
import { changeFileExtension } from '../utils/file'
import { invalidateSharedStyleCache } from './css/shared/preprocessor'
import { useLoadEntry } from './hooks/useLoadEntry'
import { collectRequireTokens } from './utils/ast'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from './utils/invalidateEntry'
import { getCssRealPath, parseRequest } from './utils/parse'
import { emitJsonAsset, emitWxmlAssetsWithCache } from './utils/wxmlEmit'

const debug = createDebugger('weapp-vite:core')

interface IndependentBuildResult {
  meta: SubPackageMetaValue
  rollup: RolldownOutput
}

interface CorePluginState {
  ctx: CompilerContext
  subPackageMeta?: SubPackageMetaValue
  loadEntry: ReturnType<typeof useLoadEntry>['loadEntry']
  loadedEntrySet: ReturnType<typeof useLoadEntry>['loadedEntrySet']
  jsonEmitFilesMap: ReturnType<typeof useLoadEntry>['jsonEmitFilesMap']
  requireAsyncEmittedChunks: Set<string>
  pendingIndependentBuilds: Promise<IndependentBuildResult>[]
  watchFilesSnapshot: string[]
}

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const { loadEntry, loadedEntrySet, jsonEmitFilesMap } = useLoadEntry(ctx)
  const state: CorePluginState = {
    ctx,
    subPackageMeta,
    loadEntry,
    loadedEntrySet,
    jsonEmitFilesMap,
    requireAsyncEmittedChunks: new Set<string>(),
    pendingIndependentBuilds: [],
    watchFilesSnapshot: [],
  }

  return [
    createTakeQueryPlugin(state),
    createWxssResolverPlugin(state),
    createCoreLifecyclePlugin(state),
    createRequireAnalysisPlugin(state),
  ]
}

const TAKE_DIRECTIVE_PREFIX = 'take:'

interface NormalizedTakeRequest {
  id: string
  legacy: boolean
}

function normalizeTakeRequest(source: string | undefined): NormalizedTakeRequest | null {
  if (!source) {
    return null
  }
  if (source.startsWith(TAKE_DIRECTIVE_PREFIX)) {
    const id = source.slice(TAKE_DIRECTIVE_PREFIX.length)
    if (!id) {
      return null
    }
    return {
      id,
      legacy: false,
    }
  }

  if (!source.includes('?')) {
    return null
  }

  const [filename, rawQuery] = source.split('?', 2)
  if (!rawQuery) {
    return null
  }

  const params = new URLSearchParams(rawQuery)
  if (!params.has('take')) {
    return null
  }

  return {
    id: filename,
    legacy: true,
  }
}

function createTakeQueryPlugin(_state: CorePluginState): Plugin {
  return {
    name: 'weapp-vite:pre:take-query',
    enforce: 'pre',
    buildStart() {
      resetTakeImportRegistry()
    },
    async resolveId(source, importer) {
      const takeRequest = normalizeTakeRequest(source)
      if (!takeRequest) {
        return null
      }
      const resolved = await this.resolve(takeRequest.id, importer, { skipSelf: true })
      if (resolved?.id) {
        markTakeModuleImporter(resolved.id, importer)
        if (takeRequest.legacy) {
          logger.warn(
            `"${source}" detected: the ?take query is deprecated, please migrate to the "take:" prefix (e.g. "take:${takeRequest.id}")`,
          )
        }
        return resolved
      }
      return null
    },
  }
}

function createWxssResolverPlugin(_state: CorePluginState): Plugin {
  return {
    name: 'weapp-vite:pre:wxss',
    enforce: 'pre',
    resolveId: {
      filter: {
        id: /\.wxss$/,
      },
      handler(id) {
        return id.replace(/\.wxss$/, '.css?wxss')
      },
    },
  }
}

function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet } = state
  const { scanService, configService, buildService } = ctx

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',

    buildStart() {
      loadedEntrySet.clear()
      if (configService.isDev) {
        const rootDir = subPackageMeta
          ? path.resolve(configService.absoluteSrcRoot, subPackageMeta.subPackage.root)
          : configService.absoluteSrcRoot
        ensureSidecarWatcher(ctx, rootDir)
        if (!subPackageMeta && configService.absolutePluginRoot) {
          ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
        }
      }
    },

    async watchChange(id: string, change: { event: ChangeEvent }) {
      const relativeSrc = configService.relativeAbsoluteSrcRoot(id)
      const relativeCwd = configService.relativeCwd(id)
      let handledByIndependentWatcher = false
      let independentMeta: SubPackageMetaValue | undefined

      if (change.event === 'create' || change.event === 'delete') {
        await invalidateEntryForSidecar(ctx, id, change.event)
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
        logger.success(`[${change.event}] ${configService.relativeCwd(id)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
      }
      else if (!handledByIndependentWatcher) {
        logger.success(`[${change.event}] ${configService.relativeCwd(id)}`)
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

      const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(id))
      if (isCSSRequest(id)) {
        const parsed = parseRequest(id)
        if (parsed.query.wxss) {
          const realPath = getCssRealPath(parsed)
          this.addWatchFile(realPath)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return { code: css }
          }
        }
        return null
      }

      if (loadedEntrySet.has(id) || subPackageMeta?.entries.includes(relativeBasename)) {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, id, 'component')
      }

      if (relativeBasename === 'app') {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, id, 'app')
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
      })
    },

    async generateBundle(_options, bundle) {
      await flushIndependentBuilds.call(this, state)

      if (!subPackageMeta) {
        const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
        const shouldLogChunks = configService.weappViteConfig?.chunks?.logOptimization ?? true
        const subPackageRoots = Array.from(scanService.subPackageMap.keys()).filter(Boolean)
        const duplicateWarningBytes = Number(configService.weappViteConfig?.chunks?.duplicateWarningBytes ?? 0)
        const shouldWarnOnDuplicate = Number.isFinite(duplicateWarningBytes) && duplicateWarningBytes > 0
        let redundantBytesTotal = 0

        function matchSubPackage(filePath: string) {
          return subPackageRoots.find(root => filePath === root || filePath.startsWith(`${root}/`))
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

        applySharedChunkStrategy.call(this, bundle, {
          strategy: sharedStrategy,
          subPackageRoots,
          onDuplicate: handleDuplicate,
          onFallback: shouldLogChunks
            ? ({ reason, importers }) => {
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

                if (reason === 'main-package') {
                  logger.info(`[subpackages] ${scope} 共享模块（${importers.length} 处引用）已提升到主包 common.js`)
                }
                else {
                  logger.info(`[subpackages] 仅主包使用共享模块（${importers.length} 处引用），保留在主包 common.js`)
                }
              }
            : undefined,
        })

        if (shouldWarnOnDuplicate && redundantBytesTotal > duplicateWarningBytes) {
          logger.warn(`[subpackages] 分包复制共享模块产生冗余体积 ${formatBytes(redundantBytesTotal)}，已超过阈值 ${formatBytes(duplicateWarningBytes)}，建议调整分包划分或运行 weapp-vite analyze 定位问题。`)
        }
      }

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

function createRequireAnalysisPlugin(state: CorePluginState): Plugin {
  const { ctx, requireAsyncEmittedChunks } = state
  const { configService } = ctx

  return {
    name: 'weapp-vite:post',
    enforce: 'post',

    transform: {
      filter: {
        id: /\.[jt]s$/,
      },
      handler(code) {
        try {
          const ast = this.parse(code)
          const { requireTokens } = collectRequireTokens(ast)

          return {
            code,
            ast,
            map: null,
            meta: { requireTokens },
          }
        }
        catch (error) {
          logger.error(error)
        }
      },
    },

    async moduleParsed(moduleInfo) {
      const requireTokens = moduleInfo.meta.requireTokens as RequireToken[]
      if (!Array.isArray(requireTokens)) {
        return
      }

      for (const requireModule of requireTokens) {
        const absPath = path.resolve(path.dirname(moduleInfo.id), requireModule.value)
        const resolved = await this.resolve(absPath, moduleInfo.id)
        if (!resolved) {
          continue
        }

        await this.load(resolved)
        if (requireAsyncEmittedChunks.has(resolved.id)) {
          continue
        }

        requireAsyncEmittedChunks.add(resolved.id)
        this.emitFile({
          type: 'chunk',
          id: resolved.id,
          fileName: configService.relativeAbsoluteSrcRoot(
            changeFileExtension(resolved.id, '.js'),
          ),
          preserveSignature: 'exports-only',
        })
      }
    },
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  const formatted = value.toFixed(precision).replace(/\.0+$/, '')
  return `${formatted} ${units[index]}`
}

function emitJsonAssets(this: any, state: CorePluginState) {
  const { ctx } = state
  const { jsonService } = ctx

  for (const jsonEmitFile of state.jsonEmitFilesMap.values()) {
    if (
      jsonEmitFile.entry.json
      && isObject(jsonEmitFile.entry.json)
      && !isEmptyObject(jsonEmitFile.entry.json)
    ) {
      const source = jsonService.resolve(jsonEmitFile.entry)
      if (source && jsonEmitFile.fileName) {
        emitJsonAsset(
          {
            emitFile: (asset) => {
              this.emitFile(asset)
            },
          },
          jsonEmitFile.fileName,
          source,
        )
      }
    }
  }
}

async function flushIndependentBuilds(
  this: any,
  state: CorePluginState,
) {
  const { subPackageMeta, pendingIndependentBuilds } = state

  if (subPackageMeta || pendingIndependentBuilds.length === 0) {
    return
  }

  const outputs = await Promise.all(pendingIndependentBuilds)

  for (const { rollup } of outputs) {
    const bundleOutputs = Array.isArray(rollup?.output) ? rollup.output : []
    for (const output of bundleOutputs) {
      if (output.type === 'chunk') {
        this.emitFile({
          type: 'asset',
          source: output.code,
          fileName: output.fileName,
          name: output.name,
        })
      }
      else {
        this.emitFile({
          type: 'asset',
          source: output.source,
          fileName: output.fileName,
        })
      }
    }
  }

  state.pendingIndependentBuilds = []
}
