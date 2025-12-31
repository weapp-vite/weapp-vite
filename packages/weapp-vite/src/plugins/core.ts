/* eslint-disable ts/no-use-before-define -- 为了可读性，插件工具函数在后面定义 */
import type { OutputBundle, OutputChunk, RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import type { BuildTarget, CompilerContext } from '../context'
import type { SharedChunkDuplicatePayload } from '../runtime/chunkStrategy'
import type { ChangeEvent, Entry, SubPackageMetaValue } from '../types'
import type { RequireToken } from './utils/ast'
import type { WxmlEmitRuntime } from './utils/wxmlEmit'
import { isEmptyObject, isObject, removeExtensionDeep } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { createDebugger } from '../debugger'
import logger from '../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY, resetTakeImportRegistry } from '../runtime/chunkStrategy'
import { isCSSRequest, toPosixPath } from '../utils'
import { changeFileExtension } from '../utils/file'
import { invalidateSharedStyleCache } from './css/shared/preprocessor'
import { useLoadEntry } from './hooks/useLoadEntry'
import { collectRequireTokens } from './utils/ast'
import { readFile as readFileCached } from './utils/cache'
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
  entriesMap: ReturnType<typeof useLoadEntry>['entriesMap']
  jsonEmitFilesMap: ReturnType<typeof useLoadEntry>['jsonEmitFilesMap']
  requireAsyncEmittedChunks: Set<string>
  pendingIndependentBuilds: Promise<IndependentBuildResult>[]
  watchFilesSnapshot: string[]
  buildTarget: BuildTarget
}

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const buildTarget = ctx.currentBuildTarget ?? 'app'
  const { loadEntry, loadedEntrySet, jsonEmitFilesMap, entriesMap } = useLoadEntry(ctx, { buildTarget })
  const state: CorePluginState = {
    ctx,
    subPackageMeta,
    loadEntry,
    loadedEntrySet,
    entriesMap,
    jsonEmitFilesMap,
    requireAsyncEmittedChunks: new Set<string>(),
    pendingIndependentBuilds: [],
    watchFilesSnapshot: [],
    buildTarget,
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
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, buildTarget } = state
  const { scanService, configService, buildService } = ctx
  const isPluginBuild = buildTarget === 'plugin'

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',

    buildStart() {
      resetTakeImportRegistry()
      loadedEntrySet.clear()
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

      const cleanId = id.split('?', 1)[0]
      const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(cleanId))

      if (loadedEntrySet.has(cleanId) || subPackageMeta?.entries.includes(relativeBasename)) {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, cleanId, 'component')
      }

      if (relativeBasename === 'app') {
        // @ts-ignore PluginContext typing from rolldown
        return await loadEntry.call(this, cleanId, 'app')
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
      await flushIndependentBuilds.call(this, state)

      if (isPluginBuild) {
        filterPluginBundleOutputs(bundle, configService)
        return
      }

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

          collect(bundle[sharedFileName])
          if (finalFileName !== sharedFileName) {
            collect(bundle[finalFileName])
          }

          if (!candidates.length) {
            const matched = Object.values(bundle).find(
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

        applySharedChunkStrategy.call(this, bundle, {
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

      removeImplicitPagePreloads(bundle, {
        configService,
        entriesMap: state.entriesMap,
      })

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
          fileName: configService.relativeOutputPath(
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

function filterPluginBundleOutputs(bundle: OutputBundle, configService: CompilerContext['configService']) {
  const pluginOutputRoot = configService.absolutePluginOutputRoot
  for (const [fileName] of Object.entries(bundle)) {
    const absolute = path.resolve(configService.outDir, fileName)
    const relative = pluginOutputRoot
      ? path.relative(pluginOutputRoot, absolute)
      : ''
    const isPluginFile = pluginOutputRoot
      ? !relative.startsWith('..') && !path.isAbsolute(relative)
      : fileName.startsWith(path.basename(configService.absolutePluginRoot ?? 'plugin'))
    if (!isPluginFile) {
      delete bundle[fileName]
    }
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

interface RemoveImplicitPagePreloadOptions {
  configService: CompilerContext['configService']
  entriesMap: Map<string, Entry | undefined>
}

function removeImplicitPagePreloads(
  bundle: OutputBundle,
  options: RemoveImplicitPagePreloadOptions,
) {
  const { configService, entriesMap } = options
  if (!entriesMap || entriesMap.size === 0) {
    return
  }

  const pageChunkFileNames = new Set<string>()
  for (const entry of entriesMap.values()) {
    if (!entry || entry.type !== 'page') {
      continue
    }
    const relative = configService.relativeAbsoluteSrcRoot(entry.path)
    const outputFile = changeFileExtension(relative, '.js')
    pageChunkFileNames.add(outputFile)
  }

  if (pageChunkFileNames.size === 0) {
    return
  }

  for (const chunk of Object.values(bundle)) {
    if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string') {
      continue
    }

    const targetSet = new Set<string>()

    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        if (pageChunkFileNames.has(imported)) {
          targetSet.add(imported)
        }
      }
    }

    const rawImplicit = (chunk as any).implicitlyLoadedBefore
    const implicitlyLoaded = Array.isArray(rawImplicit) ? rawImplicit : undefined

    if (implicitlyLoaded) {
      for (const eager of implicitlyLoaded) {
        if (pageChunkFileNames.has(eager)) {
          targetSet.add(eager)
        }
      }
    }

    if (targetSet.size === 0) {
      continue
    }

    const ranges = findImplicitRequireRemovalRanges(chunk, targetSet)
    if (!ranges.length) {
      continue
    }

    const ms = new MagicString(chunk.code)
    for (const { start, end } of ranges) {
      ms.remove(start, end)
    }
    chunk.code = ms.toString()

    if (Array.isArray(chunk.imports) && chunk.imports.length) {
      chunk.imports = chunk.imports.filter(name => !targetSet.has(name))
    }
    if (implicitlyLoaded && implicitlyLoaded.length) {
      (chunk as any).implicitlyLoadedBefore = implicitlyLoaded.filter(name => !targetSet.has(name))
    }
  }
}

interface RemovalRange {
  start: number
  end: number
}

function findImplicitRequireRemovalRanges(
  chunk: OutputChunk,
  targetFileNames: Set<string>,
): RemovalRange[] {
  const code = chunk.code
  const ranges: RemovalRange[] = []
  const requireRE = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g

  for (const match of code.matchAll(requireRE)) {
    const specifier = stripQuotes(match[1])
    const resolved = resolveRelativeImport(chunk.fileName, specifier)

    if (!resolved || !targetFileNames.has(resolved)) {
      continue
    }

    const start = match.index
    const end = start + match[0].length
    ranges.push({ start, end })
  }

  return ranges
}

function stripQuotes(value: string) {
  if (!value) {
    return value
  }
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === last && (first === '"' || first === '\'')) || (first === '`' && last === '`')) {
    return value.slice(1, -1)
  }
  return value
}

function resolveRelativeImport(fromFile: string, specifier: string) {
  if (!specifier) {
    return ''
  }
  const dir = path.posix.dirname(fromFile)
  const absolute = path.posix.resolve('/', dir, specifier)
  return absolute.startsWith('/') ? absolute.slice(1) : absolute
}

export function __removeImplicitPagePreloadsForTest(
  bundle: OutputBundle,
  options: RemoveImplicitPagePreloadOptions,
) {
  removeImplicitPagePreloads(bundle, options)
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
