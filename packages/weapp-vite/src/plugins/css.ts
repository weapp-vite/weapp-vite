import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { StyleEntry } from '../types'
import type { StylePreprocessorHookContext } from './css/preprocessorLifecycle'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { resolveGraphOutputOwner } from '../moduleGraph/outputMetadata'
import { parseSidecarSourceRequest } from '../moduleGraph/protocol'
import { isSourceStyleExtension } from '../platforms/sourceAssets'
import { getHmrStyleUpdatePlan } from '../runtime/hmrStyleUpdate'
import { changeFileExtension, isJsOrTs } from '../utils'
import { getPathExistsTtlMs } from '../utils/cachePolicy'
import { normalizeWatchPath } from '../utils/path'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { toAbsoluteId } from '../utils/toAbsoluteId'
import { compilerSourceId } from './compilerPlugin/hmr'
import { findManagedCompilerEntryMarker, hasManagedCompilerOutputMarker, isManagedCompilerEntry } from './compilerPluginRegistry'
import { resolveNativeStyleAssetUrls } from './css/assetUrls'
import {
  assertStylePreprocessing,
  beginStylePreprocessing,
  captureCompiledStyleSource,
  captureStylePreprocessorInput,
  closeStylePreprocessing,
  consumeStylePreprocessing,
  findPreparedStyleDependencies,
  findPreparedStyleSource,
  getPreparedSharedStyle,
  getPreparedStyleSource,
  hasStylePreprocessing,
  markCompiledStyleSource,
  prepareStylePreprocessing,
  recordStylePreprocessingError,
} from './css/preprocessorLifecycle'
import { cssCodeCache, processCssWithCache, renderSharedStyleEntry } from './css/shared/preprocessor'
import {
  collectSharedStyleEntries,
  injectSharedStyleImports,
  prependSharedStyleImports,
  resolveSharedStyleImportStatements,
  toPosixPath,
} from './css/shared/sharedStyles'
import { replaceSharedStyleDependencies } from './css/shared/sourceDependencies'
import { collectRenderedStyleSources } from './css/styleOwnership'
import {
  findManagedTailwindcssEntryMarker,
} from './tailwindcssMarker'
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
interface PreparedOwnedStyleAsset {
  fileName: string
  modulePath: string
  normalizedFileName: string
  processedCss: string
}

interface SharedStyleEmissionTask {
  entry: StyleEntry
  fileName: string
  absolutePath: string
}

interface SharedStyleEmissionResult extends SharedStyleEmissionTask {
  css: string
}

interface SharedStyleImportAsset {
  fileName: string
  normalizedFileName: string
  css: string
}

interface BundleStyleAnalysis {
  facadeChunks: OutputChunk[]
  ownersByCssAsset: Map<string, Set<string>>
  styleAssets: Array<{
    bundleKey: string
    asset: OutputAsset
  }>
}

type SharedStyleImportCache = Map<string, string[]>

const LEADING_BLANK_LINES_RE = /^(?:[ \t]*\r?\n)+/
const COMPILER_CONTENT_HMR_NONCE_RE = /\n\/\* weapp-vite (?:compiler-content|tailwind-content) [^*\n]+ \*\/$/
const VITE_PREPROCESS_STYLE_RE = /\.(?:acss|css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/
const TAILWIND_GENERATOR_PLACEHOLDER = '/*! weapp-tailwindcss generator-placeholder */'
const VITE_STYLE_ASSET_PLACEHOLDER_RE = /__VITE_ASSET__([\w$]+)__(?:\$_(.*?)__)?/g

interface CssEmitPluginContext extends StylePreprocessorHookContext {
  addWatchFile?: (id: string) => void
  emitFile: (asset: { type: 'asset', fileName: string, source: string, originalFileName?: string }) => void
  getFileName?: (referenceId: string) => string
  getModuleInfo?: Parameters<typeof collectRenderedStyleSources>[0]['getModuleInfo']
}

function resolveViteStyleAssetPlaceholders(
  source: string,
  fileName: string,
  pluginCtx: CssEmitPluginContext,
) {
  if (!source.includes('__VITE_ASSET__') || typeof pluginCtx.getFileName !== 'function') {
    return source
  }

  return source.replace(VITE_STYLE_ASSET_PLACEHOLDER_RE, (_placeholder, referenceId: string, postfix = '') => {
    const assetFileName = toPosixPath(pluginCtx.getFileName!(referenceId))
    const relativePath = path.posix.relative(path.posix.dirname(toPosixPath(fileName)), assetFileName)
    const assetUrl = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
    return `${encodeURI(assetUrl)}${postfix}`
  })
}

const pendingOwnerStyleSources = new WeakMap<CompilerContext, Map<string, string[]>>()

export function consumePendingOwnerStyleSources(ctx: CompilerContext) {
  const sources = pendingOwnerStyleSources.get(ctx)
  pendingOwnerStyleSources.delete(ctx)
  return sources
}

function findGeneratorBoundary(css: string) {
  const externalIndex = css.indexOf(TAILWIND_GENERATOR_PLACEHOLDER)
  const managedIndex = findManagedTailwindcssEntryMarker(css)
  const compilerIndex = findManagedCompilerEntryMarker(css)
  const boundaryIndexes = [externalIndex, managedIndex, compilerIndex].filter(index => index >= 0)
  return boundaryIndexes.length > 0 ? Math.min(...boundaryIndexes) : -1
}

function extractPendingOwnerStyleSource(css: string) {
  const boundary = findGeneratorBoundary(css)
  return (boundary < 0 ? css : css.slice(0, boundary)).trim()
}

export function recordPendingOwnerStyleSource(ctx: CompilerContext, fileName: string, css: string) {
  const authorCss = extractPendingOwnerStyleSource(css)
  if (!authorCss) {
    return
  }
  const sources = pendingOwnerStyleSources.get(ctx) ?? new Map<string, string[]>()
  const fragments = sources.get(fileName) ?? []
  if (!fragments.includes(authorCss)) {
    fragments.push(authorCss)
  }
  sources.set(fileName, fragments)
  pendingOwnerStyleSources.set(ctx, sources)
}

function stripLeadingBlankLines(code: string) {
  return code.replace(LEADING_BLANK_LINES_RE, '')
}

function isSourceStyleAsset(fileName: string) {
  const extension = path.extname(fileName)
  return isSourceStyleExtension(extension)
    || /\.(?:stylus|pcss|postcss|sss)$/.test(fileName)
}

function hasCompilerContentDirtyReason(ctx: CompilerContext) {
  return Boolean(getHmrStyleUpdatePlan(ctx.configService)?.compilerContentOwners.size)
}

function appendCompilerContentHmrNonce(ctx: CompilerContext, source: string) {
  const plan = getHmrStyleUpdatePlan(ctx.configService)
  if (!plan?.compilerContentOwners.size) {
    return source
  }
  const marker = [...plan.compilerContentOwners.values()].includes('compiler-content')
    ? 'compiler-content'
    : 'tailwind-content'
  return `${source}\n/* weapp-vite ${marker} ${plan.id} */`
}

function stripCompilerContentHmrNonce(source: string) {
  return source.replace(COMPILER_CONTENT_HMR_NONCE_RE, '')
}

function isStyleBundleAsset(output: OutputBundle[string], bundleKey: string): output is OutputAsset {
  if (output.type !== 'asset') {
    return false
  }
  const fileName = output.fileName || bundleKey
  return isSourceStyleAsset(fileName)
}

function hasStyleBundleAsset(bundle: OutputBundle) {
  for (const [bundleKey, output] of Object.entries(bundle)) {
    if (isStyleBundleAsset(output, bundleKey)) {
      return true
    }
  }
  return false
}

function shouldSkipUnchangedStyleHmrBundle(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  if (!ctx.configService?.isDev) {
    return false
  }

  const plan = getHmrStyleUpdatePlan(ctx.configService)
  if (!plan || plan.full) {
    return false
  }

  return !plan.styleFiles.size && !plan.compilerContentOwners.size && !hasStyleBundleAsset(bundle)
}

function shouldPreprocessWithVite(fileName: string) {
  return VITE_PREPROCESS_STYLE_RE.test(fileName)
}

function hasViteStyleAssetPlaceholder(source: string) {
  return source.includes('__VITE_ASSET__') || source.includes('__VITE_PUBLIC_ASSET__')
}

async function preprocessStyleSource(
  ctx: CompilerContext,
  pluginCtx: StylePreprocessorHookContext,
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
      dependencies: findPreparedStyleDependencies(ctx, pluginCtx, fileName),
    }
  }

  const processed = await consumeStylePreprocessing(ctx, pluginCtx, resolvedConfig, fileName, normalizedCss)
  return {
    css: stripLeadingBlankLines(processed.code),
    dependencies: processed.deps ? Array.from(processed.deps) : [],
  }
}

async function readStyleGraphSource(ctx: CompilerContext, hook: StylePreprocessorHookContext, stylePath: string, fallback: string, required = true) {
  if (hasStylePreprocessing(ctx, hook) && isSourceStyleAsset(stylePath)) {
    return required ? getPreparedStyleSource(ctx, hook, stylePath, true)! : findPreparedStyleSource(ctx, hook, stylePath) ?? fallback
  }
  try {
    return await fs.readFile(stylePath, 'utf8')
  }
  catch {
    return fallback
  }
}

async function resolveMemoryStyleSource(ctx: CompilerContext, stylePath: string, hook?: StylePreprocessorHookContext) {
  if (hook && hasStylePreprocessing(ctx, hook)) {
    return getPreparedStyleSource(ctx, hook, stylePath)
  }
  const sourceId = normalizeFsResolvedId(stylePath, { stripLeadingNullByte: true })
  const cache = ctx.runtimeState?.css?.transformedSidecarSource
  const cached = cache?.get(sourceId)
  if (!cached) {
    return
  }
  try {
    const diskSource = await fs.readFile(stylePath, 'utf8')
    if (diskSource === cached.diskSource) {
      return cached.code
    }
  }
  catch {}
  cache?.delete(sourceId)
}

function resolveOutputStyleFileName(
  configService: CompilerContext['configService'],
  stylePath: string,
) {
  return configService.relativeOutputPath(
    changeFileExtension(stylePath, configService.outputExtensions.wxss),
  )
}

function resolveCurrentHmrStyleSourcePath(
  ctx: CompilerContext,
  normalizedFileName: string,
) {
  return [...getHmrStyleUpdatePlan(ctx.configService)?.styleFiles ?? []].find((file) => {
    const outputFile = resolveOutputStyleFileName(ctx.configService, file)
    return outputFile !== undefined && toPosixPath(outputFile) === normalizedFileName
  })
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

// 样式缓存只保存准备内容；最终内容去重必须在发布阶段登记所有权之后执行。
function emitPreparedCssAsset(
  ctx: CompilerContext,
  pluginCtx: CssEmitPluginContext,
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
  const resolvedSource = resolveViteStyleAssetPlaceholders(source, fileName, pluginCtx)
  const emittedSource = hasManagedCompilerOutputMarker(resolvedSource)
    ? resolvedSource
    : appendCompilerContentHmrNonce(ctx, resolvedSource)
  if (existing?.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== emittedSource) {
      existing.source = emittedSource
    }
    cache?.set(normalizedFileName, resolvedSource)
    return true
  }

  pluginCtx.emitFile({
    type: 'asset',
    fileName,
    ...(options?.originalFileName ? { originalFileName: options.originalFileName } : {}),
    source: emittedSource,
  })
  cache?.set(normalizedFileName, resolvedSource)
  return true
}

function injectSharedStyleImportsCached(
  css: string,
  modulePath: string,
  fileName: string,
  sharedStyles: Map<string, StyleEntry[]>,
  configService: CompilerContext['configService'],
  cache: SharedStyleImportCache,
) {
  const cacheKey = `${modulePath}\0${fileName}`
  let statements = cache.get(cacheKey)
  if (!statements) {
    statements = resolveSharedStyleImportStatements(modulePath, fileName, sharedStyles, configService)
    cache.set(cacheKey, statements)
  }

  let missingStatements: string[] | undefined
  for (const statement of statements) {
    if (css.includes(statement)) {
      continue
    }
    missingStatements ??= []
    missingStatements.push(statement)
  }
  if (!missingStatements?.length) {
    return css
  }
  return prependSharedStyleImports(css, missingStatements)
}

function emitMissingManagedStyleAssets(ctx: CompilerContext, pluginCtx: CssEmitPluginContext, bundle: OutputBundle) {
  if (!ctx.configService.isDev) {
    return
  }
  const emittedSource = ctx.runtimeState?.css?.emittedSource
  if (!emittedSource?.size) {
    return
  }
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk' || !output.facadeModuleId) {
      continue
    }
    const ownerId = resolveGraphOutputOwner(output.facadeModuleId) ?? output.facadeModuleId
    const fileName = resolveOutputStyleFileName(ctx.configService, ownerId)
    const source = fileName && emittedSource.get(toPosixPath(fileName))
    if (!fileName || bundle[fileName] || !source || !hasManagedCompilerOutputMarker(source)) {
      continue
    }
    if (pluginCtx.getModuleInfo?.(output.facadeModuleId) && !collectRenderedStyleSources(pluginCtx, output.facadeModuleId).size) {
      // 移除最后一个样式导入后 Vite 不再生成 CSS；由当前模块图撤销归属，清空已发布内容。
      emitPreparedCssAsset(ctx, pluginCtx, bundle, fileName, '')
    }
  }
  for (const [fileName, source] of emittedSource) {
    if (bundle[fileName] || !hasManagedCompilerOutputMarker(source)) {
      continue
    }
    // 内容变化可能只产出页面 chunk；使用 owner 已合并的完整待生成内容，
    // 保留作者规则、共享导入及入口位置，最终仍由编译器 output hook 替换标记。
    emitPreparedCssAsset(ctx, pluginCtx, bundle, fileName, source)
  }
}

function resolveStyleOwnerId(id: string) {
  return resolveGraphOutputOwner(id) ?? id
}

function analyzeBundleStyles(bundle: OutputBundle): BundleStyleAnalysis {
  const facadeChunks: OutputChunk[] = []
  const ownersByCssAsset = new Map<string, Set<string>>()
  const styleAssets: BundleStyleAnalysis['styleAssets'] = []
  for (const [bundleKey, output] of Object.entries(bundle)) {
    if (isStyleBundleAsset(output, bundleKey)) {
      styleAssets.push({ bundleKey, asset: output })
      continue
    }

    if (output.type !== 'chunk' || !output.facadeModuleId) {
      continue
    }
    facadeChunks.push(output as OutputChunk)
    const importedCss = (output as OutputChunkWithViteMetadata).viteMetadata?.importedCss
    if (!importedCss?.size) {
      continue
    }
    for (const cssAsset of importedCss) {
      const owners = ownersByCssAsset.get(cssAsset) ?? new Set<string>()
      owners.add(resolveStyleOwnerId(output.facadeModuleId))
      ownersByCssAsset.set(cssAsset, owners)
    }
  }
  return {
    facadeChunks,
    ownersByCssAsset,
    styleAssets,
  }
}

async function prepareStyleSidecarAsset(
  ctx: CompilerContext,
  pluginCtx: CssEmitPluginContext,
  stylePath: string,
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  const { configService } = ctx
  const fileName = resolveOutputStyleFileName(configService, stylePath)
  if (!fileName) {
    return false
  }
  if (isManagedCompilerEntry(ctx, stylePath)) {
    return false
  }

  const rawCss = await resolveMemoryStyleSource(ctx, stylePath, pluginCtx) ?? await fs.readFile(stylePath, 'utf8')
  const { css, dependencies } = await preprocessStyleSource(ctx, pluginCtx, rawCss, stylePath, resolvedConfig)
  const graphSource = hasStylePreprocessing(ctx, pluginCtx) ? getPreparedStyleSource(ctx, pluginCtx, stylePath, true)! : rawCss
  syncCssImportDependencies(ctx, stylePath, graphSource, dependencies)
  if (typeof pluginCtx.addWatchFile === 'function') {
    for (const dependency of dependencies) {
      pluginCtx.addWatchFile(normalizeWatchPath(dependency))
    }
  }
  const assetCss = resolveNativeStyleAssetUrls(css, stylePath, fileName, bundle, resolvedConfig?.root ?? configService.cwd)
  const processedCss = await processCssWithCache(assetCss, configService)
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const cssWithImports = injectSharedStyleImports(
    processedCss,
    stylePath,
    fileName,
    sharedStyles,
    configService,
  )

  return { fileName, css: resolveViteStyleAssetPlaceholders(cssWithImports, fileName, pluginCtx) }
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
  const prepared = await prepareStyleSidecarAsset(ctx, pluginCtx, stylePath, bundle, resolvedConfig)
  return prepared
    ? emitPreparedCssAsset(ctx, pluginCtx, bundle, prepared.fileName, prepared.css, { originalFileName: stylePath })
    : false
}

async function handleBundleEntry(
  this: any,
  ctx: CompilerContext,
  bundle: OutputBundle,
  bundleKey: string,
  asset: OutputAsset | OutputBundle[string],
  configService: CompilerContext['configService'],
  sharedStyles: Map<string, StyleEntry[]>,
  cssAssetOwners: Map<string, Set<string>>,
  emitted: Set<string>,
  sharedStyleImportCache: SharedStyleImportCache,
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
    return normalizeFsResolvedId(resolveStyleOwnerId(id), { stripLeadingNullByte: true })
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
        const graphSource = await readStyleGraphSource(ctx, this, preprocessId, rawCss, shouldPreprocess)
        const preprocessInput = shouldPreprocess && hasViteStyleAssetPlaceholder(rawCss)
          ? graphSource
          : rawCss
        const { css, dependencies } = await preprocessStyleSource(ctx, this, preprocessInput, preprocessId, resolvedConfig, {
          enabled: shouldPreprocess,
        })
        syncCssImportDependencies(ctx, preprocessId, graphSource, dependencies)
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

  const prepareOwnedStyleAsset = async (
    owner: string,
    preprocessId: string,
    shouldPreprocess: boolean,
  ): Promise<PreparedOwnedStyleAsset | undefined> => {
    const fileName = resolveOutputStyleFileName(configService, owner)
    if (!fileName) {
      return undefined
    }
    const rawCss = asset.source.toString()
    const { processedCss } = await prepareStyleAssetForOwner(rawCss, preprocessId, shouldPreprocess)
    return {
      fileName,
      modulePath: owner,
      normalizedFileName: toPosixPath(fileName),
      processedCss: resolveNativeStyleAssetUrls(processedCss, preprocessId, fileName, bundle, resolvedConfig?.root ?? configService.cwd),
    }
  }

  const emitStyleAssetForOwner = async (owner: string, preprocessId: string, shouldPreprocess: boolean) => {
    const prepared = await prepareOwnedStyleAsset(owner, preprocessId, shouldPreprocess)
    if (!prepared) {
      return undefined
    }
    const cssWithImports = injectSharedStyleImportsCached(
      prepared.processedCss,
      prepared.modulePath,
      prepared.fileName,
      sharedStyles,
      configService,
      sharedStyleImportCache,
    )
    emitPreparedCssAsset(ctx, this, bundle, prepared.fileName, cssWithImports)
    emitted.add(prepared.normalizedFileName)
    return prepared.normalizedFileName
  }

  const isCssAsset = bundleKey.endsWith('.css')
  const isFinalStyleAsset = bundleKey.endsWith(`.${configService.outputExtensions.wxss}`)
    && (!isCssAsset || path.posix.basename(bundleKey, '.css') === 'app')
  const isSourceStyleAssetKey = isSourceStyleAsset(bundleKey)
  const originalStylePath = resolveOriginalStylePath()
  if (
    isManagedCompilerEntry(ctx, originalStylePath)
    && !hasManagedCompilerOutputMarker(asset.source.toString())
  ) {
    delete bundle[bundleKey]
    return
  }

  if (isFinalStyleAsset) {
    const absOriginal = originalStylePath
    const fileName = resolveOutputStyleFileName(configService, absOriginal)

    if (fileName) {
      emitted.add(toPosixPath(fileName))
    }

    if (fileName) {
      const source = asset.source.toString()
      const canonicalSource = hasCompilerContentDirtyReason(ctx)
        ? source
        : stripCompilerContentHmrNonce(source)
      const normalizedFileName = toPosixPath(fileName)
      const freshHmrStyleSourcePath = resolveFreshHmrStyleSourcePath(ctx, normalizedFileName)
      const preprocessId = freshHmrStyleSourcePath ?? absOriginal
      const shouldPreprocess = shouldPreprocessWithVite(preprocessId)
        && (Boolean(freshHmrStyleSourcePath) || hasViteStyleAssetPlaceholder(canonicalSource) || !hasStylePreprocessing(ctx, this))
      const graphSource = await readStyleGraphSource(ctx, this, preprocessId, canonicalSource, shouldPreprocess)
      const preprocessInput = freshHmrStyleSourcePath
        ? await resolveMemoryStyleSource(ctx, freshHmrStyleSourcePath, this) ?? graphSource
        : shouldPreprocess && hasViteStyleAssetPlaceholder(canonicalSource)
          ? graphSource
          : canonicalSource
      const { css, dependencies } = await preprocessStyleSource(ctx, this, preprocessInput, preprocessId, resolvedConfig, {
        enabled: shouldPreprocess,
      })
      const graphCss = freshHmrStyleSourcePath ? preprocessInput : graphSource
      syncCssImportDependencies(ctx, preprocessId, graphCss, dependencies)
      if (typeof this.addWatchFile === 'function') {
        for (const dependency of dependencies) {
          this.addWatchFile(normalizeWatchPath(dependency))
        }
      }
      const assetCss = resolveNativeStyleAssetUrls(css, preprocessId, fileName, bundle, resolvedConfig?.root ?? configService.cwd)
      const processedCss = resolveViteStyleAssetPlaceholders(
        await processCssWithCache(assetCss, configService),
        fileName,
        this,
      )
      if (fileName !== bundleKey) {
        delete bundle[bundleKey]
        emitPreparedCssAsset(ctx, this, bundle, fileName, processedCss)
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

  const preparedOwners = (await Promise.all(Array.from(owners).map(async (owner) => {
    return await prepareOwnedStyleAsset(owner, resolveOriginalStylePath(), !isCssAsset)
  }))).filter((prepared): prepared is PreparedOwnedStyleAsset => prepared !== undefined)
  const normalizedBundleKey = toPosixPath(bundleKey)
  if (!isCssAsset || !preparedOwners.some(prepared => prepared.normalizedFileName === normalizedBundleKey)) {
    delete bundle[bundleKey]
  }
  return preparedOwners
}

async function emitSharedStyleEntries(
  this: any,
  ctx: CompilerContext,
  sharedStyles: Map<string, StyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  if (!sharedStyles.size) {
    return
  }

  const tasks: SharedStyleEmissionTask[] = []
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

      tasks.push({
        entry,
        fileName,
        absolutePath,
      })
    }
  }

  const renderedEntries = await Promise.all(tasks.map(async (task): Promise<SharedStyleEmissionResult | undefined> => {
    const { entry, absolutePath, fileName } = task

    if (!await pathExistsCached(absolutePath, { ttlMs: getPathExistsTtlMs(configService) })) {
      return undefined
    }

    const prepared = hasStylePreprocessing(ctx, this) ? getPreparedSharedStyle(ctx, this, absolutePath) : undefined
    const { css: renderedCss, dependencies, source } = await renderSharedStyleEntry(entry, configService, resolvedConfig, prepared)
    const graphCss = source ?? await readStyleGraphSource(ctx, this, absolutePath, renderedCss)
    syncCssImportDependencies(ctx, absolutePath, graphCss, dependencies)
    if (typeof this.addWatchFile === 'function' && dependencies.length) {
      for (const dependency of dependencies) {
        if (dependency && dependency !== absolutePath) {
          this.addWatchFile(normalizeWatchPath(dependency))
        }
      }
    }

    const assetCss = resolveNativeStyleAssetUrls(renderedCss, absolutePath, fileName, bundle, resolvedConfig?.root ?? configService.cwd)
    const css = resolveViteStyleAssetPlaceholders(await processCssWithCache(assetCss, configService), fileName, this)

    return {
      ...task,
      css,
    }
  }))

  for (const result of renderedEntries) {
    if (!result) {
      continue
    }
    if (emitted.has(result.fileName)) {
      continue
    }

    if (bundle[result.fileName]) {
      delete bundle[result.fileName]
    }

    emitted.add(result.fileName)
    emitPreparedCssAsset(ctx, this, bundle, result.fileName, result.css)
  }
}

async function prepareSharedStyleImportForModule(
  sharedStyles: Map<string, StyleEntry[]>,
  configService: CompilerContext['configService'],
  sharedStyleImportCache: SharedStyleImportCache,
  moduleId: string,
): Promise<SharedStyleImportAsset | undefined> {
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

  const cssWithImports = injectSharedStyleImportsCached(
    '',
    moduleId,
    fileName,
    sharedStyles,
    configService,
    sharedStyleImportCache,
  )

  if (!cssWithImports.trim()) {
    return
  }

  const processedCss = await processCssWithCache(cssWithImports, configService)

  return {
    fileName,
    normalizedFileName,
    css: processedCss,
  }
}

async function emitSharedStyleImportsForChunks(
  this: any,
  ctx: CompilerContext,
  sharedStyles: Map<string, StyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  facadeChunks: OutputChunk[],
  sharedStyleImportCache: SharedStyleImportCache,
) {
  if (!sharedStyles.size) {
    return
  }

  const handledModuleIds = new Set<string>()

  const chunkImportAssets = await Promise.all(
    facadeChunks.map(async (output) => {
      const moduleId = output.facadeModuleId
      if (!moduleId) {
        return
      }
      const ownerId = resolveStyleOwnerId(moduleId)
      handledModuleIds.add(normalizeFsResolvedId(ownerId))

      return prepareSharedStyleImportForModule(sharedStyles, configService, sharedStyleImportCache, ownerId)
    }),
  )
  for (const asset of chunkImportAssets) {
    if (!asset || emitted.has(asset.normalizedFileName)) {
      continue
    }
    emitPreparedCssAsset(ctx, this, bundle, asset.fileName, asset.css)
    emitted.add(asset.normalizedFileName)
  }

  if (!ctx.configService?.isDev) {
    return
  }

  const importerOwners = getHmrStyleUpdatePlan(ctx.configService)?.cssImporterOwners
  if (!importerOwners?.size) {
    return
  }

  const hmrImportAssets = await Promise.all(
    Array.from(importerOwners).map(async (moduleId) => {
      if (handledModuleIds.has(normalizeFsResolvedId(moduleId))) {
        return
      }
      return prepareSharedStyleImportForModule(sharedStyles, configService, sharedStyleImportCache, moduleId)
    }),
  )
  for (const asset of hmrImportAssets) {
    if (!asset || emitted.has(asset.normalizedFileName)) {
      continue
    }
    emitPreparedCssAsset(ctx, this, bundle, asset.fileName, asset.css)
    emitted.add(asset.normalizedFileName)
  }
}

async function emitCollectedStyleSidecars(
  this: any,
  ctx: CompilerContext,
  bundle: OutputBundle,
  emittedOwners: Set<string>,
  resolvedConfig?: ResolvedConfig,
) {
  const sidecarImports = ctx.runtimeState?.css?.sidecarImports
  if (!sidecarImports?.size) {
    return
  }

  const plan = ctx.configService.isDev ? getHmrStyleUpdatePlan(ctx.configService) : undefined
  const updatingOwners = plan && !plan.full
    ? new Set([
        ...plan.styleFiles,
        ...plan.cssImporterOwners,
        ...plan.compilerContentOwners.keys(),
      ].flatMap((source) => {
        const output = resolveOutputStyleFileName(ctx.configService, source)
        return output ? [toPosixPath(output)] : []
      }))
    : undefined
  if (plan && updatingOwners) {
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk' || !output.facadeModuleId) {
        continue
      }
      const source = resolveStyleOwnerId(output.facadeModuleId)
      if (!plan.sourceFiles.has(normalizeFsResolvedId(source)) || !this.getModuleInfo?.(output.facadeModuleId)) {
        continue
      }
      // 本轮真实入口撤销最后一个 CSS 导入时，只让剩余独立 sidecar 接管。
      // 仍有真实样式来源或本轮没有参与构建的入口不能被原始内容覆盖。
      if (collectRenderedStyleSources(this, output.facadeModuleId).size) {
        continue
      }
      const fileName = resolveOutputStyleFileName(ctx.configService, source)
      if (fileName) {
        updatingOwners.add(toPosixPath(fileName))
      }
    }
  }
  const ownerSidecars = new Map<string, {
    fileName: string
    originalFileName: string
    sources: Map<string, string>
  }>()
  for (const stylePath of sidecarImports) {
    const fileName = resolveOutputStyleFileName(ctx.configService, stylePath)
    if (!fileName) {
      continue
    }
    const owner = toPosixPath(fileName)
    // 本轮 owner 产物已包含真实导入和独立原生 sidecar，仅补尚未生成的目标。
    if (emittedOwners.has(owner)) {
      continue
    }
    // 登记并集属于整个开发会话；增量代只能补发本轮样式计划涉及的 owner。
    // 未触碰 owner 的完整编译结果由原生发布保留，不能用原始 sidecar 覆盖。
    if (updatingOwners && !updatingOwners.has(owner)) {
      continue
    }
    let group = ownerSidecars.get(owner)
    if (!group) {
      group = { fileName, originalFileName: stylePath, sources: new Map() }
      ownerSidecars.set(owner, group)
    }
    group.sources.set(compilerSourceId(stylePath), stylePath)
  }
  await Promise.all(Array.from(ownerSidecars.values(), async (group) => {
    const sidecars = await Promise.all(Array.from(group.sources.values(), stylePath =>
      prepareStyleSidecarAsset(ctx, this, stylePath, bundle, resolvedConfig)))
    const fragments = sidecars.flatMap(sidecar => sidecar ? [sidecar.css] : [])
    if (fragments.length) {
      // 同一输出合并后只发布一次，避免并发 sidecar 覆盖彼此及完整内容缓存。
      emitPreparedCssAsset(ctx, this, bundle, group.fileName, fragments.join('\n'), {
        originalFileName: group.originalFileName,
      })
      emittedOwners.add(toPosixPath(group.fileName))
    }
  }))
}

async function generateBundleSharedCss(
  this: any,
  ctx: CompilerContext,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  analysis: BundleStyleAnalysis,
  resolvedConfig?: ResolvedConfig,
) {
  pendingOwnerStyleSources.delete(ctx)
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const emitted = new Set<string>()
  const {
    facadeChunks,
    ownersByCssAsset,
    styleAssets,
  } = analysis
  const sharedStyleImportCache: SharedStyleImportCache = new Map()
  const tasks = styleAssets.map(({ bundleKey, asset }) => {
    return handleBundleEntry.call(this, ctx, bundle, bundleKey, asset, configService, sharedStyles, ownersByCssAsset, emitted, sharedStyleImportCache, resolvedConfig)
  })

  const preparedOwnerStyles = (await Promise.all(tasks))
    .flatMap(result => result ?? [])
  const ownerStyleGroups = new Map<string, {
    fileName: string
    fragments: string[]
    modulePath: string
    sources: Set<string>
  }>()
  for (const prepared of preparedOwnerStyles) {
    let group = ownerStyleGroups.get(prepared.normalizedFileName)
    if (!group) {
      group = {
        fileName: prepared.fileName,
        fragments: [],
        modulePath: prepared.modulePath,
        sources: new Set<string>(),
      }
      ownerStyleGroups.set(prepared.normalizedFileName, group)
    }
    group.fragments.push(prepared.processedCss)
    for (const source of collectRenderedStyleSources(this, prepared.modulePath)) {
      group.sources.add(compilerSourceId(source))
    }
  }
  for (const [normalizedFileName, group] of ownerStyleGroups) {
    const mergedCss = group.fragments.join('\n')
    let cssWithImports = injectSharedStyleImportsCached(
      mergedCss,
      group.modulePath,
      group.fileName,
      sharedStyles,
      configService,
      sharedStyleImportCache,
    )
    const independentSidecars = Array.from(ctx.runtimeState?.css?.sidecarImports ?? []).filter((stylePath) => {
      const output = resolveOutputStyleFileName(configService, stylePath)
      return output && toPosixPath(output) === normalizedFileName && !group.sources.has(compilerSourceId(stylePath))
    })
    const sidecarStyles = await Promise.all(independentSidecars.map(stylePath =>
      prepareStyleSidecarAsset(ctx, this, stylePath, bundle, resolvedConfig),
    ))
    const sidecarCss = sidecarStyles.flatMap(style => style ? [style.css] : [])
    if (sidecarCss.length) {
      // 相邻原生样式与 SFC 内容必须先合并，再更新本轮产物和 HMR 缓存。
      cssWithImports = [...sidecarCss, cssWithImports].join('\n')
    }
    if (group.fragments.some(fragment => findGeneratorBoundary(fragment) >= 0)) {
      const ownerCss = [...sidecarCss, ...group.fragments]
        .map(extractPendingOwnerStyleSource)
        .filter(Boolean)
        .join('\n')
      const ownerCssWithImports = injectSharedStyleImportsCached(
        ownerCss,
        group.modulePath,
        group.fileName,
        sharedStyles,
        configService,
        sharedStyleImportCache,
      )
      recordPendingOwnerStyleSource(ctx, group.fileName, ownerCssWithImports)
    }
    emitPreparedCssAsset(ctx, this, bundle, group.fileName, cssWithImports)
    emitted.add(normalizedFileName)
  }
  // 最终资产、真实 CSS 和独立 sidecar 共用本轮输出归属；共享导入只补尚未生成的 owner。
  await emitCollectedStyleSidecars.call(this, ctx, bundle, emitted, resolvedConfig)
  await emitSharedStyleEntries.call(this, ctx, sharedStyles, emitted, configService, bundle, resolvedConfig)
  await emitSharedStyleImportsForChunks.call(this, ctx, sharedStyles, emitted, configService, bundle, facadeChunks, sharedStyleImportCache)
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
      buildStart() {
        beginStylePreprocessing(ctx, this)
      },
      async transform(code, id) {
        const sidecar = parseSidecarSourceRequest(id)
        if (!resolvedConfig || (sidecar && (sidecar.kind !== 'style' || sidecar.dependencyOnly)) || (!sidecar && !shouldPreprocessWithVite(id))) {
          return null
        }
        const sourceId = normalizeFsResolvedId(sidecar?.sourceId ?? id, { stripLeadingNullByte: true })
        if (!shouldPreprocessWithVite(sourceId)) {
          return null
        }
        try {
          const diskSource = await fs.readFile(sourceId, 'utf8')
          captureStylePreprocessorInput(ctx, this, sourceId, { code, diskSource })
        }
        catch {}
        return null
      },
      buildEnd: {
        order: 'pre',
        sequential: true,
        async handler(error) {
          if (error || !resolvedConfig) {
            closeStylePreprocessing(ctx, this)
            return
          }
          try {
            const sharedFiles = new Set([...collectSharedStyleEntries(ctx, configService).values()].flatMap(entries => entries.map(entry => entry.absolutePath)))
            const files = new Set([
              ...ctx.runtimeState?.css?.sidecarImports ?? [],
              ...ctx.runtimeState?.css?.transformedSidecarSource.keys() ?? [],
              ...getHmrStyleUpdatePlan(configService)?.styleFiles ?? [],
              ...sharedFiles,
            ])
            for (const id of this.getModuleIds()) {
              if (parseSidecarSourceRequest(id)?.dependencyOnly || /[?&](?:raw|url)(?:[=&]|$)/.test(id)) {
                continue
              }
              const file = normalizeFsResolvedId(id, { stripLeadingNullByte: true })
              if (isSourceStyleAsset(file)) {
                files.add(file)
              }
            }
            await prepareStylePreprocessing(ctx, this, resolvedConfig, files, file => shouldPreprocessWithVite(file) || sharedFiles.has(file))
            assertStylePreprocessing(ctx, this)
            // 共享来源按完整图阶段登记；局部输出已由其他分支发射时，产物去重不能退休依赖归属。
            replaceSharedStyleDependencies(ctx.moduleGraphService, [...sharedFiles].flatMap((file) => {
              const source = findPreparedStyleSource(ctx, this, file)
              return source === undefined
                ? []
                : [{
                    source: file,
                    dependencies: syncCssImportDependencies(ctx, file, source, findPreparedStyleDependencies(ctx, this, file)),
                  }]
            }))
          }
          catch (error) {
            recordStylePreprocessingError(ctx, this, error)
          }
        },
      },
      closeBundle() {
        closeStylePreprocessing(ctx, this)
      },
      closeWatcher() {
        closeStylePreprocessing(ctx, this)
      },
      generateBundle: {
        // Vite 必须先完成 CSS 分块、纯样式 chunk 清理和产物定稿，再把资产归属到小程序 owner。
        order: 'post',
        async handler(_opts, bundle) {
          assertStylePreprocessing(ctx, this)
          const rolldownBundle = bundle as unknown as OutputBundle
          if (!shouldSkipUnchangedStyleHmrBundle(ctx, rolldownBundle)) {
            const styleAnalysis = analyzeBundleStyles(rolldownBundle)
            await generateBundleSharedCss.call(this, ctx, configService, bundle, styleAnalysis, resolvedConfig)
          }
          emitMissingManagedStyleAssets(ctx, this, rolldownBundle)
        },
      },
    },
    {
      name: 'weapp-vite:css-sidecar-source',
      buildEnd: {
        order: 'post',
        sequential: true,
        handler() {
          assertStylePreprocessing(ctx, this)
        },
      },
      async transform(code, id) {
        const sidecar = parseSidecarSourceRequest(id)
        if (!sidecar && resolvedConfig && hasStylePreprocessing(ctx, this) && shouldPreprocessWithVite(id)) {
          // 普通图内样式同样已经过 Vite CSS；只保存规范请求，避免混淆不同 query 的转换。
          try {
            const sourceId = normalizeFsResolvedId(id, { stripLeadingNullByte: true })
            const diskSource = await fs.readFile(sourceId, 'utf8')
            captureCompiledStyleSource(ctx, this, sourceId, { code, diskSource }, resolvedConfig)
          }
          catch {}
          return null
        }
        if (!sidecar || sidecar.kind !== 'style' || sidecar.dependencyOnly) {
          return null
        }
        const sourceId = normalizeFsResolvedId(sidecar.sourceId, { stripLeadingNullByte: true })
        try {
          const diskSource = await fs.readFile(sourceId, 'utf8')
          const source = { code, diskSource }
          if (resolvedConfig && shouldPreprocessWithVite(sourceId)) {
            markCompiledStyleSource(source, resolvedConfig, this)
            captureCompiledStyleSource(ctx, this, sourceId, source, resolvedConfig)
          }
          ctx.runtimeState?.css?.transformedSidecarSource.set(sourceId, source)
        }
        catch {
          ctx.runtimeState?.css?.transformedSidecarSource.delete(sourceId)
        }
        return null
      },
    },
  ]
}
