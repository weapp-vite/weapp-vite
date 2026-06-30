import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { preprocessCSS } from 'vite'
import { changeFileExtension, isJsOrTs } from '../utils'
import { getPathExistsTtlMs } from '../utils/cachePolicy'
import { normalizeWatchPath } from '../utils/path'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { toAbsoluteId } from '../utils/toAbsoluteId'
import { cssCodeCache, processCssWithCache, renderSharedStyleEntry } from './css/shared/preprocessor'
import { collectSharedStyleEntries, injectSharedStyleImports, toPosixPath } from './css/shared/sharedStyles'
import { pathExists as pathExistsCached } from './utils/cache'
import { syncCssImportDependencies } from './utils/invalidateEntry'

export { cssCodeCache }

interface ViteMetadata {
  importedCss?: Set<string>
}

type OutputChunkWithViteMetadata = OutputChunk & {
  viteMetadata?: ViteMetadata
}

interface PreparedStyleAsset {
  processedCss: string
}

const LEADING_BLANK_LINES_RE = /^(?:[ \t]*\r?\n)+/
const SOURCE_STYLE_ASSET_RE = /\.(?:wxss|css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/
const VITE_PREPROCESS_STYLE_RE = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/

function stripLeadingBlankLines(code: string) {
  return code.replace(LEADING_BLANK_LINES_RE, '')
}

function isSourceStyleAsset(fileName: string) {
  return SOURCE_STYLE_ASSET_RE.test(fileName)
}

function hasStyleAssetOutput(bundle: OutputBundle) {
  return Object.entries(bundle).some(([bundleKey, output]) => {
    if (output?.type !== 'asset') {
      return false
    }
    const fileName = output.fileName || bundleKey
    return isSourceStyleAsset(fileName)
  })
}

function hasStyleDirtyReason(dirtyReasonSummary: string[]) {
  return dirtyReasonSummary.some(reason =>
    reason.startsWith('style-sidecar:')
    || reason.startsWith('css-importer:')
    || reason.startsWith('entry-style-only:'),
  )
}

function shouldSkipUnchangedStyleHmrBundle(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  if (!ctx.configService?.isDev) {
    return false
  }

  const dirtyReasonSummary = ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary
  if (!dirtyReasonSummary?.length) {
    return false
  }

  return !hasStyleDirtyReason(dirtyReasonSummary) && !hasStyleAssetOutput(bundle)
}

function shouldPreprocessWithVite(fileName: string) {
  return VITE_PREPROCESS_STYLE_RE.test(fileName)
}

async function preprocessStyleSource(
  code: string,
  fileName: string,
  resolvedConfig: ResolvedConfig | undefined,
  options?: {
    enabled?: boolean
  },
) {
  const normalizedCss = stripLeadingBlankLines(code)
  if (!resolvedConfig || options?.enabled === false || !shouldPreprocessWithVite(fileName)) {
    return {
      css: normalizedCss,
      dependencies: [] as string[],
    }
  }

  const processed = await preprocessCSS(normalizedCss, fileName, resolvedConfig)
  return {
    css: stripLeadingBlankLines(processed.code),
    dependencies: processed.deps ? Array.from(processed.deps) : [],
  }
}

async function readStyleGraphSource(stylePath: string, fallback: string) {
  try {
    return await fs.readFile(stylePath, 'utf8')
  }
  catch {
    return fallback
  }
}

function resolveOutputStyleFileName(
  configService: CompilerContext['configService'],
  stylePath: string,
) {
  return configService.relativeOutputPath(
    changeFileExtension(stylePath, configService.outputExtensions.wxss),
  )
}

function isUnchangedDevHmrStyleAsset(
  ctx: CompilerContext,
  normalizedFileName: string,
  current: string,
  source: string,
) {
  const hmrState = ctx.runtimeState?.build?.hmr
  const currentHmrFile = hmrState?.profile.file
  if (typeof currentHmrFile === 'string') {
    const currentOutputFile = resolveOutputStyleFileName(ctx.configService, currentHmrFile)
    if (currentOutputFile && toPosixPath(currentOutputFile) === normalizedFileName) {
      return false
    }
  }
  const isDevHmr = ctx.configService?.isDev === true
    && (
      hmrState?.didEmitAllEntries === true
      || (hmrState?.lastHmrEntryIds?.size ?? 0) > 0
      || (hmrState?.lastEmittedEntryIds?.size ?? 0) > 0
      || hmrState?.profile.event !== undefined
    )
  return isDevHmr
    && current === source
    && ctx.runtimeState?.css?.emittedSource.get(normalizedFileName) === source
}

function resolveCurrentHmrStyleSourcePath(
  ctx: CompilerContext,
  normalizedFileName: string,
) {
  const hmrState = ctx.runtimeState?.build?.hmr
  const currentHmrFile = hmrState?.profile.file
  if (typeof currentHmrFile !== 'string') {
    return undefined
  }
  const currentOutputFile = resolveOutputStyleFileName(ctx.configService, currentHmrFile)
  if (currentOutputFile === undefined || toPosixPath(currentOutputFile) !== normalizedFileName) {
    return undefined
  }
  return currentHmrFile
}

function resolveFreshHmrStyleSourcePath(
  ctx: CompilerContext,
  normalizedFileName: string,
) {
  const currentHmrFile = resolveCurrentHmrStyleSourcePath(ctx, normalizedFileName)
  if (!currentHmrFile || currentHmrFile.endsWith('.css') || !shouldPreprocessWithVite(currentHmrFile)) {
    return undefined
  }
  return currentHmrFile
}

function emitCssAssetIfChanged(
  ctx: CompilerContext,
  pluginCtx: { emitFile: (asset: { type: 'asset', fileName: string, source: string, originalFileName?: string }) => void },
  bundle: OutputBundle,
  fileName: string,
  source: string,
  options?: {
    originalFileName?: string
  },
) {
  const normalizedFileName = toPosixPath(fileName)
  const cache = ctx.runtimeState?.css?.emittedSource
  const existing = bundle[fileName]

  if (existing?.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (isUnchangedDevHmrStyleAsset(ctx, normalizedFileName, current, source)) {
      delete bundle[fileName]
      return false
    }
    if (current !== source) {
      existing.source = source
    }
    cache?.set(normalizedFileName, source)
    return true
  }

  if (cache?.get(normalizedFileName) === source) {
    return false
  }

  pluginCtx.emitFile({
    type: 'asset',
    fileName,
    ...(options?.originalFileName ? { originalFileName: options.originalFileName } : {}),
    source,
  })
  cache?.set(normalizedFileName, source)
  return true
}

function collectCssAssetOwners(bundle: OutputBundle) {
  const ownersByCssAsset = new Map<string, Set<string>>()
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk' || !output.facadeModuleId) {
      continue
    }
    const importedCss = (output as OutputChunkWithViteMetadata).viteMetadata?.importedCss
    if (!importedCss?.size) {
      continue
    }
    for (const cssAsset of importedCss) {
      const owners = ownersByCssAsset.get(cssAsset) ?? new Set<string>()
      owners.add(output.facadeModuleId)
      ownersByCssAsset.set(cssAsset, owners)
    }
  }
  return ownersByCssAsset
}

export async function emitStyleSidecarAsset(
  ctx: CompilerContext,
  pluginCtx: {
    emitFile: (asset: { type: 'asset', fileName: string, source: string, originalFileName?: string }) => void
    addWatchFile?: (id: string) => void
  },
  bundle: OutputBundle,
  stylePath: string,
  resolvedConfig?: ResolvedConfig,
) {
  const { configService } = ctx
  const fileName = resolveOutputStyleFileName(configService, stylePath)
  if (!fileName) {
    return false
  }

  const rawCss = await fs.readFile(stylePath, 'utf8')
  const { css, dependencies } = await preprocessStyleSource(rawCss, stylePath, resolvedConfig)
  syncCssImportDependencies(ctx, stylePath, rawCss, dependencies)
  if (typeof pluginCtx.addWatchFile === 'function') {
    for (const dependency of dependencies) {
      pluginCtx.addWatchFile(normalizeWatchPath(dependency))
    }
  }
  const processedCss = await processCssWithCache(css, configService)
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const cssWithImports = injectSharedStyleImports(
    processedCss,
    stylePath,
    fileName,
    sharedStyles,
    configService,
  )

  return emitCssAssetIfChanged(ctx, pluginCtx, bundle, fileName, cssWithImports, {
    originalFileName: stylePath,
  })
}

async function handleBundleEntry(
  this: any,
  ctx: CompilerContext,
  bundle: OutputBundle,
  bundleKey: string,
  asset: OutputAsset | OutputBundle[string],
  configService: CompilerContext['configService'],
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  cssAssetOwners: Map<string, Set<string>>,
  emitted: Set<string>,
  resolvedConfig?: ResolvedConfig,
) {
  if (asset.type !== 'asset') {
    return
  }

  const toAbsolute = (id: string) => {
    const abs = toAbsoluteId(id, configService, undefined, { base: 'cwd' })
    return abs || id
  }

  const normalizeOwnerId = (id: string) => {
    return normalizeFsResolvedId(id, { stripLeadingNullByte: true })
  }
  const preparedStyleAssets = new Map<string, Promise<PreparedStyleAsset>>()

  const resolveOriginalStylePath = () => {
    const [rawOriginal] = asset.originalFileNames ?? []
    return rawOriginal
      ? toAbsolute(rawOriginal)
      : path.resolve(configService.absoluteSrcRoot, bundleKey)
  }

  const prepareStyleAssetForOwner = async (rawCss: string, preprocessId: string, shouldPreprocess: boolean) => {
    const cacheKey = `${shouldPreprocess ? 1 : 0}\0${preprocessId}\0${rawCss}`
    let cached = preparedStyleAssets.get(cacheKey)
    if (!cached) {
      cached = (async () => {
        const { css, dependencies } = await preprocessStyleSource(rawCss, preprocessId, resolvedConfig, {
          enabled: shouldPreprocess,
        })
        const graphCss = await readStyleGraphSource(preprocessId, rawCss)
        syncCssImportDependencies(ctx, preprocessId, graphCss, dependencies)
        if (typeof this.addWatchFile === 'function') {
          for (const dependency of dependencies) {
            this.addWatchFile(normalizeWatchPath(dependency))
          }
        }
        const processedCss = await processCssWithCache(css, configService)
        return {
          processedCss,
        }
      })()
      preparedStyleAssets.set(cacheKey, cached)
    }
    return cached
  }

  const emitStyleAssetForOwner = async (owner: string, preprocessId: string, shouldPreprocess: boolean) => {
    const fileName = resolveOutputStyleFileName(configService, owner)
    if (!fileName) {
      return
    }
    const normalizedFileName = toPosixPath(fileName)
    const rawCss = asset.source.toString()
    const { processedCss } = await prepareStyleAssetForOwner(rawCss, preprocessId, shouldPreprocess)

    const cssWithImports = injectSharedStyleImports(
      processedCss,
      owner,
      fileName,
      sharedStyles,
      configService,
    )

    emitCssAssetIfChanged(ctx, this, bundle, fileName, cssWithImports)
    emitted.add(normalizedFileName)
  }

  const isFinalStyleAsset = bundleKey.endsWith(`.${configService.outputExtensions.wxss}`)
  const isCssAsset = bundleKey.endsWith('.css')
  const isSourceStyleAssetKey = isSourceStyleAsset(bundleKey)

  if (isFinalStyleAsset) {
    const absOriginal = resolveOriginalStylePath()
    const fileName = resolveOutputStyleFileName(configService, absOriginal)

    if (fileName) {
      emitted.add(toPosixPath(fileName))
    }

    if (fileName) {
      const source = asset.source.toString()
      const normalizedFileName = toPosixPath(fileName)
      const freshHmrStyleSourcePath = resolveFreshHmrStyleSourcePath(ctx, normalizedFileName)
      const preprocessId = freshHmrStyleSourcePath ?? absOriginal
      const preprocessInput = freshHmrStyleSourcePath
        ? await readStyleGraphSource(freshHmrStyleSourcePath, source)
        : source
      const { css, dependencies } = await preprocessStyleSource(preprocessInput, preprocessId, resolvedConfig, {
        enabled: shouldPreprocessWithVite(preprocessId),
      })
      const graphCss = freshHmrStyleSourcePath
        ? preprocessInput
        : await readStyleGraphSource(absOriginal, source)
      syncCssImportDependencies(ctx, preprocessId, graphCss, dependencies)
      if (typeof this.addWatchFile === 'function') {
        for (const dependency of dependencies) {
          this.addWatchFile(normalizeWatchPath(dependency))
        }
      }
      const processedCss = await processCssWithCache(css, configService)
      if (fileName !== bundleKey) {
        delete bundle[bundleKey]
        emitCssAssetIfChanged(ctx, this, bundle, fileName, processedCss)
      }
      else if (isUnchangedDevHmrStyleAsset(ctx, normalizedFileName, source, processedCss)) {
        delete bundle[bundleKey]
      }
      else if (processedCss !== source) {
        asset.source = processedCss
      }
      ctx.runtimeState?.css?.emittedSource.set(normalizedFileName, processedCss)
    }

    return
  }

  if (!isCssAsset && !isSourceStyleAssetKey) {
    return
  }

  const ownersFromChunks = cssAssetOwners.get(bundleKey)
  const owners = ownersFromChunks?.size
    ? ownersFromChunks
    : new Set(
        (asset.originalFileNames ?? [])
          .map(normalizeOwnerId)
          .filter((originalFileName) => {
            return isJsOrTs(originalFileName) || originalFileName.endsWith('.vue')
          })
          .map(toAbsolute),
      )

  if (!owners.size) {
    if (isSourceStyleAssetKey && !isCssAsset) {
      await emitStyleAssetForOwner(resolveOriginalStylePath(), resolveOriginalStylePath(), !isCssAsset)
      delete bundle[bundleKey]
      return
    }
    delete bundle[bundleKey]
    return
  }

  await Promise.all(Array.from(owners).map(async (owner) => {
    const modulePath = owner
    await emitStyleAssetForOwner(modulePath, resolveOriginalStylePath(), !isCssAsset)
  }))

  delete bundle[bundleKey]
}

async function emitSharedStyleEntries(
  this: any,
  ctx: CompilerContext,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  if (!sharedStyles.size) {
    return
  }

  for (const entries of sharedStyles.values()) {
    for (const entry of entries) {
      const fileName = toPosixPath(entry.outputRelativePath)
      if (emitted.has(fileName)) {
        continue
      }

      const absolutePath = entry.absolutePath
      if (typeof this.addWatchFile === 'function') {
        this.addWatchFile(normalizeWatchPath(absolutePath))
      }

      if (!await pathExistsCached(absolutePath, { ttlMs: getPathExistsTtlMs(configService) })) {
        continue
      }

      const { css: renderedCss, dependencies } = await renderSharedStyleEntry(entry, configService, resolvedConfig)
      const graphCss = await readStyleGraphSource(absolutePath, renderedCss)
      syncCssImportDependencies(ctx, absolutePath, graphCss, dependencies)
      if (typeof this.addWatchFile === 'function' && dependencies.length) {
        for (const dependency of dependencies) {
          if (dependency && dependency !== absolutePath) {
            this.addWatchFile(normalizeWatchPath(dependency))
          }
        }
      }

      const css = await processCssWithCache(renderedCss, configService)

      emitted.add(fileName)
      if (bundle[fileName]) {
        delete bundle[fileName]
      }

      emitCssAssetIfChanged(ctx, this, bundle, fileName, css)
    }
  }
}

async function emitSharedStyleImportForModule(
  this: any,
  ctx: CompilerContext,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  moduleId: string,
) {
  const { outputExtensions } = configService
  const relativeModulePath = configService.relativeAbsoluteSrcRoot(moduleId)
  if (!relativeModulePath) {
    return
  }

  const converted = changeFileExtension(moduleId, outputExtensions.wxss)
  const fileName = configService.relativeOutputPath(converted)
  if (!fileName) {
    return
  }

  const normalizedFileName = toPosixPath(fileName)
  if (emitted.has(normalizedFileName)) {
    return
  }

  const cssWithImports = injectSharedStyleImports(
    '',
    moduleId,
    fileName,
    sharedStyles,
    configService,
  )

  if (!cssWithImports.trim()) {
    return
  }

  const processedCss = await processCssWithCache(cssWithImports, configService)

  emitCssAssetIfChanged(ctx, this, bundle, fileName, processedCss)

  emitted.add(normalizedFileName)
}

async function emitSharedStyleImportsForChunks(
  this: any,
  ctx: CompilerContext,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
) {
  if (!sharedStyles.size) {
    return
  }

  const handledModuleIds = new Set<string>()

  await Promise.all(
    Object.values(bundle).map(async (output) => {
      if (output.type !== 'chunk') {
        return
      }

      const moduleId = output.facadeModuleId
      if (!moduleId) {
        return
      }
      handledModuleIds.add(normalizeFsResolvedId(moduleId))

      await emitSharedStyleImportForModule.call(this, ctx, sharedStyles, emitted, configService, bundle, moduleId)
    }),
  )

  if (!ctx.configService?.isDev) {
    return
  }

  const dirtyReasonSummary = ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary
  const isCssImporterHmr = dirtyReasonSummary?.some(reason => reason.startsWith('css-importer:')) === true
  if (!isCssImporterHmr) {
    return
  }

  await Promise.all(
    Array.from(ctx.runtimeState?.build?.hmr?.lastHmrEntryIds ?? []).map(async (moduleId) => {
      if (handledModuleIds.has(normalizeFsResolvedId(moduleId))) {
        return
      }
      await emitSharedStyleImportForModule.call(this, ctx, sharedStyles, emitted, configService, bundle, moduleId)
    }),
  )
}

async function generateBundleSharedCss(
  this: any,
  ctx: CompilerContext,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const cssAssetOwners = collectCssAssetOwners(bundle)
  const emitted = new Set<string>()
  const tasks = Object.entries(bundle).map(([bundleKey, asset]) => {
    return handleBundleEntry.call(this, ctx, bundle, bundleKey, asset, configService, sharedStyles, cssAssetOwners, emitted, resolvedConfig)
  })

  await Promise.all(tasks)
  await emitSharedStyleEntries.call(this, ctx, sharedStyles, emitted, configService, bundle, resolvedConfig)
  await emitSharedStyleImportsForChunks.call(this, ctx, sharedStyles, emitted, configService, bundle)
}

export function css(ctx: CompilerContext): Plugin[] {
  const { configService } = ctx
  let resolvedConfig: ResolvedConfig | undefined
  return [
    {
      name: 'weapp-vite:css',
      enforce: 'pre',
      configResolved(config) {
        resolvedConfig = config
      },
      async generateBundle(_opts, bundle) {
        if (shouldSkipUnchangedStyleHmrBundle(ctx, bundle as unknown as OutputBundle)) {
          return
        }
        await generateBundleSharedCss.call(this, ctx, configService, bundle, resolvedConfig)
      },
    },
  ]
}
