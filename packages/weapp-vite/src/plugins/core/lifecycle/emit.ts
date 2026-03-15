import type { OutputBundle, OutputChunk } from 'rolldown'
import type { RuntimeChunkDuplicatePayload, SharedChunkDuplicatePayload } from '../../../runtime/chunkStrategy'
import type { SubPackageMetaValue } from '../../../types'
import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral, resolveAstEngine } from '../../../ast'
import logger from '../../../logger'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../../../runtime/chunkStrategy'
import { toPosixPath } from '../../../utils'
import { normalizeAlipayNpmImportPath } from '../../../utils/alipayNpm'
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
const WINDOWS_SEPARATOR_RE = /\\/g
const NPM_PROTOCOL_RE = /^npm:/
const PLUGIN_PROTOCOL_RE = /^plugin:\/\//
const ABSOLUTE_NPM_PREFIX_RE = /^\/(?:miniprogram_npm|node_modules)\//
const PRETTY_NODE_MODULES_RE = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(.+)/

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

function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  const injectedApiIdentifier = '__weappViteInjectedApi__'

  if (!mayContainPlatformApiAccess(code, { engine: options?.astEngine })) {
    return code
  }

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

function hasDependencyPrefix(dependencies: Record<string, string> | undefined, importee: string) {
  if (!dependencies) {
    return false
  }

  const normalizedImportee = importee.replace(WINDOWS_SEPARATOR_RE, '/').replace(NPM_PROTOCOL_RE, '')
  const importeeTokens = normalizedImportee.split('/').filter(Boolean)
  if (importeeTokens.length === 0) {
    return false
  }

  return Object.keys(dependencies).some((dep) => {
    const depTokens = dep.replace(WINDOWS_SEPARATOR_RE, '/').split('/').filter(Boolean)
    if (depTokens.length === 0 || depTokens.length > importeeTokens.length) {
      return false
    }

    for (let i = 0; i < depTokens.length; i++) {
      if (depTokens[i] !== importeeTokens[i]) {
        return false
      }
    }

    return true
  })
}

function resolveDependencyId(importee: string) {
  const normalizedImportee = importee.replace(WINDOWS_SEPARATOR_RE, '/').replace(NPM_PROTOCOL_RE, '').replace(ABSOLUTE_NPM_PREFIX_RE, '')
  const importeeTokens = normalizedImportee.split('/').filter(Boolean)
  if (importeeTokens.length === 0) {
    return ''
  }
  if (normalizedImportee.startsWith('@') && importeeTokens.length > 1) {
    return `${importeeTokens[0]}/${importeeTokens[1]}`
  }
  return importeeTokens[0]
}

function normalizeNpmImportForAlipay(importee: string, dependencies: Record<string, string> | undefined, mode?: string) {
  const trimmed = importee.trim()
  if (!trimmed || PLUGIN_PROTOCOL_RE.test(trimmed)) {
    return importee
  }

  const normalized = trimmed.replace(NPM_PROTOCOL_RE, '')
  if (normalized.startsWith('/miniprogram_npm/') || normalized.startsWith('/node_modules/')) {
    return normalizeAlipayNpmImportPath(normalized, mode)
  }

  if (!hasDependencyPrefix(dependencies, normalized)) {
    return importee
  }

  return normalizeAlipayNpmImportPath(normalized, mode)
}

function rewriteChunkNpmImportsForAlipay(
  code: string,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(code, { engine: options?.astEngine })) {
    return code
  }

  try {
    const ast = parseJsLike(code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        if (!firstArg) {
          return
        }

        const isStringLiteral = firstArg.type === 'StringLiteral' || firstArg.type === 'Literal'
        const isStaticTemplateLiteral = firstArg.type === 'TemplateLiteral'
          && Array.isArray(firstArg.expressions)
          && firstArg.expressions.length === 0
          && Array.isArray(firstArg.quasis)
          && firstArg.quasis.length === 1

        if (!isStringLiteral && !isStaticTemplateLiteral) {
          return
        }

        const currentValue = isStringLiteral
          ? firstArg.value
          : firstArg.quasis[0]?.value?.cooked ?? firstArg.quasis[0]?.value?.raw

        if (typeof currentValue !== 'string') {
          return
        }

        const nextValue = normalizeNpmImportForAlipay(currentValue, dependencies, mode)
        if (nextValue === currentValue) {
          return
        }

        if (isStringLiteral) {
          firstArg.value = nextValue
        }
        else {
          firstArg.quasis[0].value.cooked = nextValue
          firstArg.quasis[0].value.raw = nextValue
        }

        mutated = true
      },
    })

    if (!mutated) {
      return code
    }

    return generate(ast as any).code
  }
  catch {
    return code
  }
}

function rewriteBundleNpmImportsForAlipay(
  bundle: OutputBundle,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = rewriteChunkNpmImportsForAlipay(chunk.code, dependencies, mode, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

function rewriteBundlePlatformApi(
  bundle: OutputBundle,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = replacePlatformApiAccess(chunk.code, globalName, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

function matchesSubPackageDependency(dependencies: (string | RegExp)[] | undefined, importee: string, fallbackDependencies?: Record<string, string>) {
  const normalized = importee.replace(NPM_PROTOCOL_RE, '').replace(ABSOLUTE_NPM_PREFIX_RE, '')
  if (Array.isArray(dependencies) && dependencies.length > 0) {
    const dependencyId = resolveDependencyId(normalized)
    return dependencies.some((pattern) => {
      if (typeof pattern === 'string') {
        return dependencyId === pattern || normalized === pattern || normalized.startsWith(`${pattern}/`)
      }

      pattern.lastIndex = 0
      if (pattern.test(dependencyId)) {
        return true
      }

      pattern.lastIndex = 0
      return pattern.test(normalized)
    })
  }

  return hasDependencyPrefix(fallbackDependencies, normalized)
}

function normalizeWeappLocalNpmImport(importee: string) {
  const normalized = importee.replace(NPM_PROTOCOL_RE, '').replace(ABSOLUTE_NPM_PREFIX_RE, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 1 || (segments.length === 2 && normalized.startsWith('@'))) {
    return `${normalized}/index`
  }
  return normalized
}

function getRequireImportLiteral(node: any) {
  if (!node) {
    return null
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : null
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? null
  }

  return null
}

function setRequireImportLiteral(node: any, nextValue: string) {
  if (!node) {
    return
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    node.value = nextValue
    return
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    node.quasis[0].value.raw = nextValue
    node.quasis[0].value.cooked = nextValue
  }
}

function toRelativeRuntimeNpmImport(fileName: string, root: string, importee: string) {
  const normalized = normalizeWeappLocalNpmImport(importee)
  const relative = toPosixPath(path.relative(path.dirname(fileName), `${root}/miniprogram_npm/${normalized}`))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function rewriteChunkNpmImportsToLocalSubPackage(
  chunk: OutputChunk,
  meta: SubPackageMetaValue,
  dependencies: Record<string, string> | undefined,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(chunk.code, { engine: options?.astEngine })) {
    return
  }

  try {
    const ast = parseJsLike(chunk.code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        const currentValue = getRequireImportLiteral(firstArg)
        if (typeof currentValue !== 'string' || !matchesSubPackageDependency(meta.subPackage.dependencies, currentValue, dependencies)) {
          return
        }

        const nextValue = toRelativeRuntimeNpmImport(chunk.fileName, meta.subPackage.root, currentValue)
        if (nextValue === currentValue) {
          return
        }

        setRequireImportLiteral(firstArg, nextValue)
        mutated = true
      },
    })

    if (mutated) {
      chunk.code = generate(ast as any).code
    }
  }
  catch {
  }
}

function rewriteJsonNpmImportsToLocalSubPackage(bundle: OutputBundle, meta: SubPackageMetaValue, dependencies: Record<string, string> | undefined) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || typeof output.fileName !== 'string' || !output.fileName.endsWith('.json')) {
      continue
    }
    if (output.fileName === `${meta.subPackage.root}.json` || !output.fileName.startsWith(`${meta.subPackage.root}/`)) {
      continue
    }

    const source = typeof output.source === 'string' ? output.source : output.source?.toString()
    if (!source) {
      continue
    }

    try {
      const parsed = JSON.parse(source)
      if (!parsed || typeof parsed !== 'object' || !parsed.usingComponents || typeof parsed.usingComponents !== 'object' || Array.isArray(parsed.usingComponents)) {
        continue
      }

      let mutated = false
      for (const [componentName, importee] of Object.entries(parsed.usingComponents as Record<string, string>)) {
        if (typeof importee !== 'string' || !matchesSubPackageDependency(meta.subPackage.dependencies, importee, dependencies)) {
          continue
        }
        parsed.usingComponents[componentName] = toRelativeRuntimeNpmImport(output.fileName, meta.subPackage.root, importee)
        mutated = true
      }

      if (mutated) {
        output.source = `${JSON.stringify(parsed, null, 2)}\n`
      }
    }
    catch {
    }
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
  const astEngine = resolveAstEngine(configService.weappViteConfig)

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
      const subPackageRoots = [...scanService.subPackageMap.keys()].filter(Boolean)
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

        const preview = moduleLabels
          .map(prettifyModuleLabel)
          .slice(0, 3)
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
        const ignoredHint = ignoredMainImporters?.length
          ? `，忽略主包引用：${ignoredMainImporters.join('、')}`
          : ''
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

    if (configService.platform === 'alipay') {
      rewriteBundleNpmImportsForAlipay(
        rolldownBundle,
        configService.packageJson.dependencies,
        configService.weappViteConfig?.npm?.alipayNpmMode,
        { astEngine },
      )
    }
    else {
      const subPackageMap = scanService.subPackageMap ?? new Map<string, SubPackageMetaValue>()
      const localSubPackageMetas = [...subPackageMap.values()]
        .filter(meta => Array.isArray(meta?.subPackage?.dependencies) && meta.subPackage.dependencies.length > 0)

      for (const meta of localSubPackageMetas) {
        for (const output of Object.values(rolldownBundle)) {
          if (output?.type !== 'chunk') {
            continue
          }

          const chunk = output as OutputChunk
          if (chunk.fileName === meta.subPackage.root || !chunk.fileName.startsWith(`${meta.subPackage.root}/`)) {
            continue
          }
          rewriteChunkNpmImportsToLocalSubPackage(chunk, meta, configService.packageJson.dependencies, {
            astEngine,
          })
        }

        rewriteJsonNpmImportsToLocalSubPackage(rolldownBundle, meta, configService.packageJson.dependencies)
      }
    }

    const injectWeapiGlobalName = resolveInjectWeapiGlobalName(state)
    if (injectWeapiGlobalName) {
      rewriteBundlePlatformApi(rolldownBundle, injectWeapiGlobalName, {
        astEngine,
      })
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
