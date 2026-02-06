import type { OutputBundle, OutputChunk } from 'rolldown'
import type { SharedChunkDuplicatePayload } from '../../../runtime/chunkStrategy'
import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import logger from '../../../logger'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../../../runtime/chunkStrategy'
import { toPosixPath } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { normalizeWatchPath } from '../../../utils/path'
import { createWeapiAccessExpression } from '../../../utils/weapi'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import {
  emitJsonAssets,
  filterPluginBundleOutputs,
  flushIndependentBuilds,
  formatBytes,
  refreshModuleGraph,
  refreshSharedChunkImporters,
  removeImplicitPagePreloads,
} from '../helpers'

const platformApiIdentifiers = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])

function resolveInjectWeapiGlobalName(state: CorePluginState) {
  const injectWeapi = state.ctx.configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }
  const enabled = typeof injectWeapi === 'object'
    ? injectWeapi.enabled === true
    : injectWeapi === true
  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }
  return injectWeapi.globalName?.trim() || 'wpi'
}

function replacePlatformApiAccess(code: string, globalName: string) {
  const injectedApiIdentifier = '__weappViteInjectedApi__'

  try {
    const ast = parseJsLike(code)
    let mutated = false

    const rewritePath = (path: any) => {
      const object = path.node?.object
      if (!object || object.type !== 'Identifier') {
        return
      }
      const identifierName = object.name
      if (!platformApiIdentifiers.has(identifierName)) {
        return
      }
      if (path.scope?.hasBinding?.(identifierName)) {
        return
      }
      path.node.object = {
        type: 'Identifier',
        name: injectedApiIdentifier,
      }
      mutated = true
    }

    traverse(ast as any, {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
    })

    if (!mutated) {
      return code
    }

    const transformedCode = generate(ast as any).code
    const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
    return `${aliasCode}\n${transformedCode}`
  }
  catch {
    return code
  }
}

function rewriteBundlePlatformApi(bundle: OutputBundle, globalName: string) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = replacePlatformApiAccess(chunk.code, globalName)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return function renderStart(this: any) {
    emitJsonAssets.call(this, state)
    const runtime: WxmlEmitRuntime = {
      addWatchFile: typeof this.addWatchFile === 'function'
        ? (id: string) => { this.addWatchFile(normalizeWatchPath(id)) }
        : undefined,
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
  }
}

export function createGenerateBundleHook(state: CorePluginState, isPluginBuild: boolean) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService } = ctx

  return async function generateBundle(this: any, _options: any, bundle: any) {
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
              logger.info(`[分包] 分包 ${subPackageList} 共享模块已复制到各自 weapp-shared/common.js（${totalReferences} 处引用${ignoredHint}）`)

              if (retainedInMain) {
                logger.warn(`[分包] 模块 ${sharedFileName} 同时被主包引用，因此仍保留在主包 common.js，并复制到 ${subPackageList}，请确认是否需要将源代码移动到主包或公共目录。`)
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
                logger.info(`[分包] ${scope} 共享模块 ${sharedChunkLabel}（${importers.length} 处引用）已提升到主包 common.js`)
              }
              else {
                logger.info(`[分包] 仅主包使用共享模块 ${sharedChunkLabel}（${importers.length} 处引用），保留在主包 common.js`)
              }
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

    const injectWeapiGlobalName = resolveInjectWeapiGlobalName(state)
    if (injectWeapiGlobalName) {
      rewriteBundlePlatformApi(rolldownBundle, injectWeapiGlobalName)
    }

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
