import type { CompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import fs from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { configExtensions, supportedCssLangs, templateExtensions } from '../../constants'
import logger from '../../logger'
import { findJsEntry, touch } from '../../utils/file'

const watchedCssExts = new Set(supportedCssLangs.map(ext => `.${ext}`))
const watchedTemplateExts = new Set(templateExtensions.map(ext => `.${ext}`))
const configSuffixes = configExtensions.map(ext => `.${ext}`)
const sidecarSuffixes = [...configSuffixes, ...watchedCssExts, ...watchedTemplateExts]
const defaultIgnoredDirNames = new Set(['node_modules', 'miniprogram_npm', '.git', '.hg', '.svn', '.turbo'])
const watchLimitErrorCodes = new Set(['EMFILE', 'ENOSPC'])
const importProtocols = /^(?:https?:|data:|blob:|\/)/i
const cssImportRE = /@(?:import|wv-keep-import)\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi

function isSidecarFile(filePath: string) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
}

function isWatchLimitError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== 'object') {
    return false
  }
  const maybeError = error as NodeJS.ErrnoException
  if (!maybeError.code) {
    return false
  }
  return watchLimitErrorCodes.has(maybeError.code)
}

function normalizePath(p: string) {
  return path.normalize(p)
}

function ensureCssGraph(ctx: CompilerContext) {
  return ctx.runtimeState.css
}

function cleanupImporterGraph(
  ctx: CompilerContext,
  importer: string,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedImporter = normalizePath(importer)
  const existingDeps = graph.importerToDependencies.get(normalizedImporter)
  if (!existingDeps) {
    return
  }
  graph.importerToDependencies.delete(normalizedImporter)
  for (const dep of existingDeps) {
    const importers = graph.dependencyToImporters.get(dep)
    if (!importers) {
      continue
    }
    importers.delete(normalizedImporter)
    if (importers.size === 0) {
      graph.dependencyToImporters.delete(dep)
    }
  }
}

function registerCssImports(
  ctx: CompilerContext,
  importer: string,
  dependencies: Iterable<string>,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedImporter = normalizePath(importer)
  const normalizedDeps = new Set<string>()
  for (const dependency of dependencies) {
    if (!dependency) {
      continue
    }
    normalizedDeps.add(normalizePath(dependency))
  }

  const previousDeps = graph.importerToDependencies.get(normalizedImporter) ?? new Set<string>()
  if (previousDeps.size) {
    for (const previous of previousDeps) {
      if (normalizedDeps.has(previous)) {
        continue
      }
      const importers = graph.dependencyToImporters.get(previous)
      if (!importers) {
        continue
      }
      importers.delete(normalizedImporter)
      if (importers.size === 0) {
        graph.dependencyToImporters.delete(previous)
      }
    }
  }

  graph.importerToDependencies.set(normalizedImporter, normalizedDeps)

  for (const dependency of normalizedDeps) {
    let importers = graph.dependencyToImporters.get(dependency)
    if (!importers) {
      importers = new Set<string>()
      graph.dependencyToImporters.set(dependency, importers)
    }
    importers.add(normalizedImporter)
  }
}

export async function extractCssImportDependencies(
  ctx: CompilerContext,
  importer: string,
) {
  try {
    const stats = await fs.promises.stat(importer)
    if (!stats.isFile()) {
      cleanupImporterGraph(ctx, importer)
      return
    }
  }
  catch {
    cleanupImporterGraph(ctx, importer)
    return
  }

  let cssContent: string
  try {
    cssContent = await fs.promises.readFile(importer, 'utf8')
  }
  catch {
    cleanupImporterGraph(ctx, importer)
    return
  }

  cssImportRE.lastIndex = 0
  const dependencies = new Set<string>()
  const dir = path.dirname(importer)
  while (true) {
    const match = cssImportRE.exec(cssContent)
    if (!match) {
      break
    }
    const rawSpecifier = match[1]?.trim()
    if (!rawSpecifier) {
      continue
    }

    if (importProtocols.test(rawSpecifier)) {
      if (rawSpecifier.startsWith('/')) {
        const absolute = path.resolve(ctx.configService.absoluteSrcRoot, rawSpecifier.slice(1))
        dependencies.add(absolute)
        const ext = path.extname(absolute)
        if (ext) {
          dependencies.add(absolute.slice(0, -ext.length))
        }
      }
      continue
    }

    let specifier = rawSpecifier
    if (specifier.startsWith('@/')) {
      specifier = path.join(ctx.configService.absoluteSrcRoot, specifier.slice(2))
    }
    else if (specifier === '@') {
      specifier = ctx.configService.absoluteSrcRoot
    }

    if (specifier.startsWith('~')) {
      specifier = specifier.slice(1)
    }

    const cleaned = specifier.replace(/[?#].*$/, '')

    const resolved = path.resolve(dir, cleaned)
    dependencies.add(resolved)
    const ext = path.extname(resolved)
    if (!ext) {
      dependencies.add(resolved)
    }
    else {
      dependencies.add(resolved.slice(0, -ext.length))
    }
  }

  registerCssImports(ctx, importer, dependencies)
}

function collectCssImporters(
  ctx: CompilerContext,
  dependency: string,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedDependency = normalizePath(dependency)
  const matches = new Set<string>()

  const direct = graph.dependencyToImporters.get(normalizedDependency)
  if (direct) {
    for (const importer of direct) {
      matches.add(importer)
    }
  }

  const ext = path.extname(normalizedDependency)
  if (ext) {
    const base = normalizedDependency.slice(0, -ext.length)
    const baseMatches = graph.dependencyToImporters.get(base)
    if (baseMatches) {
      for (const importer of baseMatches) {
        matches.add(importer)
      }
    }
  }

  return matches
}

async function resolveScriptForCss(
  cache: Map<string, string | undefined>,
  basePath: string,
) {
  const cached = cache.get(basePath)
  if (cached !== undefined) {
    return cached
  }
  const result = await findJsEntry(basePath)
  const scriptPath = result.path
  cache.set(basePath, scriptPath)
  return scriptPath
}

async function collectAffectedScriptsAndImporters(
  ctx: CompilerContext,
  startCssFile: string,
) {
  const queue: string[] = [normalizePath(startCssFile)]
  const visitedCss = new Set<string>()
  const affectedImporters = new Set<string>()
  const affectedScripts = new Set<string>()
  const scriptCache = new Map<string, string | undefined>()

  while (queue.length) {
    const current = queue.shift()!
    if (visitedCss.has(current)) {
      continue
    }
    visitedCss.add(current)

    const ext = path.extname(current)
    if (ext) {
      const base = current.slice(0, -ext.length)
      const script = await resolveScriptForCss(scriptCache, base)
      if (script) {
        affectedScripts.add(script)
      }
    }

    const importers = collectCssImporters(ctx, current)
    for (const importer of importers) {
      if (!visitedCss.has(importer)) {
        queue.push(importer)
      }
      affectedImporters.add(importer)
    }
  }

  return {
    importers: affectedImporters,
    scripts: affectedScripts,
  }
}

export async function invalidateEntryForSidecar(ctx: CompilerContext, filePath: string, event: ChangeEvent = 'update') {
  const configSuffix = configSuffixes.find(suffix => filePath.endsWith(suffix))
  const ext = path.extname(filePath)
  const normalizedPath = normalizePath(filePath)

  let scriptBasePath: string | undefined

  if (configSuffix) {
    scriptBasePath = filePath.slice(0, -configSuffix.length)
  }
  else if (ext && watchedCssExts.has(ext)) {
    scriptBasePath = filePath.slice(0, -ext.length)
  }
  else if (ext && watchedTemplateExts.has(ext)) {
    scriptBasePath = filePath.slice(0, -ext.length)
  }

  if (!scriptBasePath) {
    return
  }

  const touchedTargets = new Set<string>()
  const touchedScripts = new Set<string>()

  const primaryScript = await findJsEntry(scriptBasePath)
  if (primaryScript.path) {
    touchedScripts.add(primaryScript.path)
  }

  if (!primaryScript.path && ext && watchedCssExts.has(ext)) {
    const { importers, scripts } = await collectAffectedScriptsAndImporters(ctx, normalizedPath)
    for (const importer of importers) {
      touchedTargets.add(importer)
    }
    for (const script of scripts) {
      touchedScripts.add(script)
    }
  }

  const isCssSidecar = Boolean(ext && watchedCssExts.has(ext))
  const isTemplateSidecar = Boolean(ext && watchedTemplateExts.has(ext))
  const configService = ctx.configService
  const relativeSource = configService.relativeCwd(normalizedPath)

  for (const target of touchedTargets) {
    try {
      await touch(target)
    }
    catch {}
  }

  for (const script of touchedScripts) {
    try {
      await touch(script)
    }
    catch {}
  }

  if (!touchedTargets.size && !touchedScripts.size) {
    if (event === 'create' && (isCssSidecar || isTemplateSidecar)) {
      logger.info(`[sidecar:${event}] ${relativeSource} 新增，但未找到引用方，等待后续关联`)
    }
    return
  }

  const touchedList: string[] = []
  for (const target of touchedTargets) {
    touchedList.push(configService.relativeCwd(target))
  }
  for (const script of touchedScripts) {
    touchedList.push(configService.relativeCwd(script))
  }

  const uniqueTouched = Array.from(new Set(touchedList))

  logger.success(`[sidecar:${event}] ${relativeSource} -> 刷新 ${uniqueTouched.join(', ')}`)
}

export function ensureSidecarWatcher(ctx: CompilerContext, rootDir: string) {
  if (!ctx.configService.isDev || !rootDir || process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return
  }

  const { sidecarWatcherMap } = ctx.runtimeState.watcher
  const absRoot = path.normalize(rootDir)

  if (!fs.existsSync(absRoot)) {
    return
  }

  if (sidecarWatcherMap.has(absRoot)) {
    return
  }

  let isReady = false

  const handleSidecarChange = (event: ChangeEvent, filePath: string, ready: boolean) => {
    if (!isSidecarFile(filePath)) {
      return
    }

    const ext = path.extname(filePath)
    const isCssFile = Boolean(ext && watchedCssExts.has(ext))

    if (isCssFile && (event === 'create' || event === 'update')) {
      void extractCssImportDependencies(ctx, filePath)
    }

    const isDeleteEvent = event === 'delete'
    const shouldInvalidate = (event === 'create' && ready) || isDeleteEvent
    if (shouldInvalidate) {
      void (async () => {
        await invalidateEntryForSidecar(ctx, filePath, event)
        if (isCssFile && isDeleteEvent) {
          cleanupImporterGraph(ctx, filePath)
        }
      })()
      return
    }

    if (isCssFile && isDeleteEvent) {
      cleanupImporterGraph(ctx, filePath)
    }
  }

  const patterns = [
    ...configExtensions.map(ext => path.join(absRoot, `**/*.${ext}`)),
    ...supportedCssLangs.map(ext => path.join(absRoot, `**/*.${ext}`)),
    ...templateExtensions.map(ext => path.join(absRoot, `**/*.${ext}`)),
  ]

  const ignoredMatcher = createSidecarIgnoredMatcher(ctx, absRoot)

  const watcher = chokidar.watch(patterns, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 20,
    },
    ignored: ignoredMatcher,
  })

  const forwardChange = (event: ChangeEvent, input: string, options?: { silent?: boolean }) => {
    if (!input) {
      return
    }
    const normalizedPath = path.normalize(input)
    if (!options?.silent) {
      logger.info(`[watch:${event}] ${ctx.configService.relativeCwd(normalizedPath)}`)
    }
    handleSidecarChange(event, normalizedPath, isReady)
  }

  watcher.on('add', path => forwardChange('create', path))
  watcher.on('change', path => forwardChange('update', path))
  watcher.on('unlink', path => forwardChange('delete', path))
  watcher.on('raw', (eventName, rawPath, details) => {
    if (eventName !== 'rename') {
      return
    }
    const candidate = typeof rawPath === 'string'
      ? rawPath
      : rawPath && typeof (rawPath as { toString?: () => string }).toString === 'function'
        ? (rawPath as { toString: () => string }).toString()
        : ''
    if (!candidate) {
      return
    }
    const baseDir = typeof details === 'object' && details && 'watchedPath' in details
      ? (details as { watchedPath?: string }).watchedPath ?? absRoot
      : absRoot
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(baseDir, candidate)
    const exists = fs.existsSync(resolved)
    const derivedEvent: ChangeEvent = exists ? 'create' : 'delete'
    const relativeResolved = ctx.configService.relativeCwd(resolved)
    logger.info(`[watch:rename->${derivedEvent}] ${relativeResolved}`)
    forwardChange(derivedEvent, resolved, { silent: true })
  })

  watcher.on('ready', () => {
    isReady = true
  })

  watcher.on('error', (error) => {
    if (!isWatchLimitError(error)) {
      return
    }
    const relativeRoot = ctx.configService.relativeCwd(absRoot)
    const code = error?.code ?? 'UNKNOWN'
    logger.warn(`[watch] ${relativeRoot} 监听数量达到上限 (${code})，侧车文件监听已停用`)
  })

  sidecarWatcherMap.set(absRoot, {
    close: () => void watcher.close(),
  })
}

export function createSidecarIgnoredMatcher(ctx: CompilerContext, rootDir: string) {
  const configService = ctx.configService
  const ignoredRoots = new Set<string>()
  const normalizedRoot = path.normalize(rootDir)

  for (const dirName of defaultIgnoredDirNames) {
    ignoredRoots.add(path.join(normalizedRoot, dirName))
  }

  if (configService?.mpDistRoot) {
    ignoredRoots.add(path.resolve(configService.cwd, configService.mpDistRoot))
  }
  else {
    ignoredRoots.add(path.join(normalizedRoot, 'dist'))
  }

  if (configService?.outDir) {
    ignoredRoots.add(path.resolve(configService.cwd, configService.outDir))
  }

  return (candidate: string) => {
    const normalized = path.normalize(candidate)
    for (const ignored of ignoredRoots) {
      if (normalized === ignored || normalized.startsWith(`${ignored}${path.sep}`)) {
        return true
      }
    }
    return false
  }
}
