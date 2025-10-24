import type { CompilerContext } from '../../context'
import fs from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../constants'
import logger from '../../logger'
import { findJsEntry, touch } from '../../utils/file'

const watchedCssExts = new Set(supportedCssLangs.map(ext => `.${ext}`))
const configSuffixes = configExtensions.map(ext => `.${ext}`)
const sidecarSuffixes = [...configSuffixes, ...watchedCssExts]
const watchLimitErrorCodes = new Set(['EMFILE', 'ENOSPC'])

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

export async function invalidateEntryForSidecar(filePath: string) {
  const configSuffix = configSuffixes.find(suffix => filePath.endsWith(suffix))
  const ext = path.extname(filePath)

  let scriptBasePath: string | undefined

  if (configSuffix) {
    scriptBasePath = filePath.slice(0, -configSuffix.length)
  }
  else if (ext && watchedCssExts.has(ext)) {
    scriptBasePath = filePath.slice(0, -ext.length)
  }

  if (!scriptBasePath) {
    return
  }

  const { path: scriptPath } = await findJsEntry(scriptBasePath)
  if (!scriptPath) {
    return
  }

  await touch(scriptPath)
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

  const handleSidecarChange = (filePath: string) => {
    if (!isSidecarFile(filePath)) {
      return
    }
    void invalidateEntryForSidecar(filePath)
  }

  const patterns = [
    ...configExtensions.map(ext => path.join(absRoot, `**/*.${ext}`)),
    ...supportedCssLangs.map(ext => path.join(absRoot, `**/*.${ext}`)),
  ]

  const watcher = chokidar.watch(patterns, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 20,
    },
  })

  const forwardChange = (input: string) => {
    if (!input) {
      return
    }
    handleSidecarChange(path.normalize(input))
  }

  watcher.on('add', forwardChange)
  watcher.on('unlink', forwardChange)
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
    forwardChange(resolved)
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

function isSidecarFile(filePath: string) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
}
