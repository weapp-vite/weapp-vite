import type { CompilerContext } from '../../../context'
import type { ChangeEvent } from '../../../types'
import fs from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { configExtensions, supportedCssLangs, templateExtensions } from '../../../constants'
import logger from '../../../logger'
import { cleanupCssImporterGraph, extractCssImportDependencies } from './cssGraph'
import { defaultIgnoredDirNames, isSidecarFile, isWatchLimitError, watchedCssExts } from './shared'
import { invalidateEntryForSidecar } from './sidecar'

export function ensureSidecarWatcher(ctx: CompilerContext, rootDir: string) {
  if (
    !ctx.configService.isDev
    || !rootDir
    || process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || process.env.WEAPP_VITE_DISABLE_SIDECAR_WATCH === '1'
  ) {
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
          cleanupCssImporterGraph(ctx, filePath)
        }
      })()
      return
    }

    if (isCssFile && isDeleteEvent) {
      cleanupCssImporterGraph(ctx, filePath)
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

    if (ignoredMatcher(resolved)) {
      return
    }
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
    logger.warn(`[监听] ${relativeRoot} 监听数量达到上限 (${code})，侧车文件监听已停用`)
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
