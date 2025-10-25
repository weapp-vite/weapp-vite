/* eslint-disable ts/no-use-before-define -- plugin utilities declared later for readability */
import type { RolldownOutput, RolldownWatcher } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { ChangeEvent, SubPackageMetaValue } from '../types'
import type { RequireToken } from './utils/ast'
import type { WxmlEmitRuntime } from './utils/wxmlEmit'
import { isEmptyObject, isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import { createDebugger } from '../debugger'
import logger from '../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../runtime/chunkStrategy'
import { createIndependentBuildError } from '../runtime/independentError'
import { isCSSRequest } from '../utils'
import { changeFileExtension } from '../utils/file'
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
    createWxssResolverPlugin(state),
    createCoreLifecyclePlugin(state),
    createRequireAnalysisPlugin(state),
  ]
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
  const { scanService, configService, buildService, watcherService } = ctx

  async function runIndependentBuild(root: string, meta: SubPackageMetaValue, versionSnapshot: number) {
    try {
      const rollup = await build(
        configService.merge(meta, meta.subPackage.inlineConfig, {
          build: {
            write: false,
            rolldownOptions: {
              output: {
                chunkFileNames() {
                  return `${meta.subPackage.root}/[name].js`
                },
              },
            },
          },
        }),
      )
      return await resolveIndependentBuildResult(buildService, root, rollup, versionSnapshot)
    }
    catch (error) {
      const normalized = createIndependentBuildError(root, error)
      buildService.failIndependentOutput(root, normalized)
      logger.error(`[independent] ${root} 构建失败: ${normalized.message}`)
      throw normalized
    }
  }

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

      if (change.event === 'create' || change.event === 'delete') {
        await invalidateEntryForSidecar(id)
      }

      if (!subPackageMeta) {
        if (relativeSrc === 'app.json' || relativeCwd === 'project.config.json' || relativeCwd === 'project.private.config.json') {
          scanService.markDirty()
        }

        const independentRoot = Array.from(scanService.independentSubPackageMap.keys()).find((root) => {
          return relativeSrc.startsWith(`${root}/`)
        })

        if (independentRoot) {
          scanService.markIndependentDirty(independentRoot)
        }
      }

      if (subPackageMeta) {
        logger.success(`[${change.event}] ${configService.relativeCwd(id)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
      }
      else {
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
        const enqueueIndependentBuild = (task: Promise<IndependentBuildResult>) => {
          task.catch(() => {}) // mark rejection as handled if build short-circuits
          pendingIndependentBuilds.push(task)
        }
        for (const root of dirtyIndependentRoots) {
          const meta = scanService.independentSubPackageMap.get(root)
          if (!meta) {
            continue
          }
          const versionSnapshot = buildService.getIndependentVersion(root)
          const existingWatcher = watcherService.getRollupWatcher(root)
          if (existingWatcher) {
            const waitPromise = buildService
              .waitForIndependentOutput(root, versionSnapshot)
              .then((rollup) => {
                return {
                  meta,
                  rollup,
                }
              })
              .catch(async () => {
                const rollup = await runIndependentBuild(root, meta, versionSnapshot)
                return {
                  meta,
                  rollup,
                }
              })
            enqueueIndependentBuild(waitPromise)
            continue
          }

          enqueueIndependentBuild(
            runIndependentBuild(root, meta, versionSnapshot).then((rollup) => {
              return {
                meta,
                rollup,
              }
            }),
          )
        }

        state.pendingIndependentBuilds = pendingIndependentBuilds

        if (state.pendingIndependentBuilds.length) {
          buildService.queue.start()
        }
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

        function matchSubPackage(filePath: string) {
          return subPackageRoots.find(root => filePath === root || filePath.startsWith(`${root}/`))
        }

        applySharedChunkStrategy.call(this, bundle, {
          strategy: sharedStrategy,
          subPackageRoots,
          onDuplicate: shouldLogChunks
            ? ({ duplicates }) => {
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
                logger.info(`[subpackages] 分包 ${subPackageList} 共享模块已复制到各自 __shared__/common.js（${totalReferences} 处引用）`)
              }
            : undefined,
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

function isRolldownWatcherLike(candidate: RolldownOutput | RolldownOutput[] | RolldownWatcher): candidate is RolldownWatcher {
  return Boolean(candidate)
    && typeof candidate === 'object'
    && typeof (candidate as RolldownWatcher).on === 'function'
    && typeof (candidate as RolldownWatcher).close === 'function'
}

async function resolveIndependentBuildResult(
  buildService: CompilerContext['buildService'],
  root: string,
  rollup: RolldownOutput | RolldownOutput[] | RolldownWatcher,
  versionSnapshot: number,
): Promise<RolldownOutput> {
  if (!buildService) {
    throw new Error('buildService is not initialized')
  }

  if (Array.isArray(rollup)) {
    const [first] = rollup
    if (!first) {
      throw new Error(`独立分包 ${root} 未产生输出`)
    }
    buildService.storeIndependentOutput(root, first)
    return first
  }

  if (isRolldownWatcherLike(rollup)) {
    buildService.registerIndependentWatcher(root, rollup)
    return await buildService.waitForIndependentOutput(root, versionSnapshot)
  }

  buildService.storeIndependentOutput(root, rollup)
  return rollup
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
    for (const output of rollup.output) {
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
