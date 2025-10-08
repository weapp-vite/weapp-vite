import type { CompilerContext } from '../../context'
import fs from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../constants'
import { findJsEntry, touch } from '../../utils/file'

const watchedCssExts = new Set(supportedCssLangs.map(ext => `.${ext}`))
const configSuffixes = configExtensions.map(ext => `.${ext}`)
const sidecarSuffixes = [...configSuffixes, ...watchedCssExts]
const supportsRecursiveWatch = process.platform === 'darwin' || process.platform === 'win32'

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

  if (supportsRecursiveWatch) {
    const watcher = fs.watch(absRoot, { recursive: true }, (_event, filename) => {
      if (!filename) {
        return
      }
      const resolved = path.join(absRoot, filename.toString())
      handleSidecarChange(resolved)
    })

    sidecarWatcherMap.set(absRoot, {
      close: async () => {
        watcher.close()
      },
    })
    return
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

  watcher.on('add', handleSidecarChange)
  watcher.on('unlink', handleSidecarChange)

  sidecarWatcherMap.set(absRoot, {
    close: () => watcher.close(),
  })
}

function isSidecarFile(filePath: string) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
}
