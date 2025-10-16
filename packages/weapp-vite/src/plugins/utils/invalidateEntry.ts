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
const supportsRecursiveWatch = process.platform === 'darwin' || process.platform === 'win32'
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

  const registerChokidarWatcher = () => {
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

    watcher.on('add', handleSidecarChange)
    watcher.on('unlink', handleSidecarChange)

    sidecarWatcherMap.set(absRoot, {
      close: () => watcher.close(),
    })
  }

  const registerDisabledWatcher = () => {
    sidecarWatcherMap.set(absRoot, {
      close: () => {},
    })
  }

  const warnWatchLimit = (error: NodeJS.ErrnoException | undefined, action: 'fallback' | 'disable') => {
    const relativeRoot = ctx.configService.relativeCwd(absRoot)
    const code = error?.code ?? 'UNKNOWN'
    const message = action === 'fallback'
      ? `[watch] ${relativeRoot} 监听数量达到上限 (${code})，正在回退到 chokidar watcher`
      : `[watch] ${relativeRoot} 监听数量达到上限 (${code})，已停用侧车文件监听`
    logger.warn(message)
  }

  if (supportsRecursiveWatch) {
    try {
      const watcher = fs.watch(absRoot, { recursive: true }, (_event, filename) => {
        if (!filename) {
          return
        }
        const resolved = path.join(absRoot, filename.toString())
        handleSidecarChange(resolved)
      })

      let handledWatchLimit = false
      const handleWatchLimit = (error: NodeJS.ErrnoException | undefined) => {
        if (handledWatchLimit) {
          return
        }
        handledWatchLimit = true
        try {
          watcher?.close()
        }
        catch {
        }
        if (supportsRecursiveWatch) {
          warnWatchLimit(error, 'disable')
          registerDisabledWatcher()
        }
        else {
          warnWatchLimit(error, 'fallback')
          registerChokidarWatcher()
        }
      }

      watcher.on('error', (error: NodeJS.ErrnoException) => {
        if (isWatchLimitError(error)) {
          handleWatchLimit(error)
        }
      })

      sidecarWatcherMap.set(absRoot, {
        close: () => watcher?.close(),
      })
      return
    }
    catch (error) {
      if (isWatchLimitError(error)) {
        if (supportsRecursiveWatch) {
          warnWatchLimit(error as NodeJS.ErrnoException, 'disable')
          registerDisabledWatcher()
        }
        else {
          warnWatchLimit(error as NodeJS.ErrnoException, 'fallback')
          registerChokidarWatcher()
        }
        return
      }
      throw error
    }
  }

  registerChokidarWatcher()
}

function isSidecarFile(filePath: string) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
}
