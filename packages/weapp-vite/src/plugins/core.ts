/* eslint-disable ts/no-use-before-define -- plugin utilities declared later for readability */
import type { RolldownOutput, RolldownWatcher } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { ChangeEvent, SubPackageMetaValue } from '../types'
import type { RequireToken } from './utils/ast'
import { isEmptyObject, isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import { createDebugger } from '../debugger'
import logger from '../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../runtime/chunkStrategy'
import { isCSSRequest } from '../utils'
import { changeFileExtension } from '../utils/file'
import { handleWxml } from '../wxml/handle'
import { useLoadEntry } from './hooks/useLoadEntry'
import { collectRequireTokens } from './utils/ast'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from './utils/invalidateEntry'
import { getCssRealPath, parseRequest } from './utils/parse'

const debug = createDebugger('weapp-vite:core')

interface IndependentBuildResult {
  meta: SubPackageMetaValue
  rollup: RolldownOutput | RolldownOutput[] | RolldownWatcher
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
        for (const root of dirtyIndependentRoots) {
          const meta = scanService.independentSubPackageMap.get(root)
          if (!meta) {
            continue
          }

          pendingIndependentBuilds.push(
            build(
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
            ).then((rollup) => {
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
      state.watchFilesSnapshot = emitWxmlAssets.call(this, state)
    },

    async generateBundle(_options, bundle) {
      await flushIndependentBuilds.call(this, state, watcherService)

      if (!subPackageMeta) {
        const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
        applySharedChunkStrategy.call(this, bundle, {
          strategy: sharedStrategy,
          subPackageRoots: scanService.subPackageMap.keys(),
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
        this.emitFile({
          type: 'asset',
          fileName: changeFileExtension(jsonEmitFile.fileName, 'json'),
          source,
        })
      }
    }
  }
}

function emitWxmlAssets(this: any, state: CorePluginState): string[] {
  const { ctx, subPackageMeta } = state
  const { configService, scanService, wxmlService } = ctx

  const currentPackageWxmls = Array.from(wxmlService.tokenMap.entries())
    .map(([id, token]) => {
      return {
        id,
        token,
        fileName: configService.relativeAbsoluteSrcRoot(id),
      }
    })
    .filter(({ fileName }) => {
      if (subPackageMeta) {
        return fileName.startsWith(subPackageMeta.subPackage.root)
      }
      return scanService.isMainPackageFileName(fileName)
    })

  const emittedFiles: string[] = []

  for (const { id, fileName, token } of currentPackageWxmls) {
    if (typeof this.addWatchFile === 'function') {
      this.addWatchFile(id)
      const deps = wxmlService.depsMap.get(id)
      if (deps) {
        for (const dep of deps) {
          this.addWatchFile(dep)
        }
      }
    }
    emittedFiles.push(fileName)
    const result = handleWxml(token)
    this.emitFile({
      type: 'asset',
      fileName,
      source: result.code,
    })
  }

  return emittedFiles
}

async function flushIndependentBuilds(
  this: any,
  state: CorePluginState,
  watcherService: CompilerContext['watcherService'],
) {
  const { subPackageMeta, pendingIndependentBuilds } = state

  if (subPackageMeta || pendingIndependentBuilds.length === 0) {
    return
  }

  const outputs = (await Promise.all(pendingIndependentBuilds)).reduce<RolldownOutput[]>(
    (acc, { meta, rollup }) => {
      const chunk = Array.isArray(rollup) ? rollup[0] : rollup
      if (!chunk) {
        return acc
      }

      if ('output' in chunk) {
        acc.push(chunk)
      }
      else {
        watcherService.setRollupWatcher(chunk as RolldownWatcher, meta.subPackage.root)
      }

      return acc
    },
    [],
  )

  for (const chunk of outputs) {
    for (const output of chunk.output) {
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
