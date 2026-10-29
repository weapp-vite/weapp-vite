import type { CompilerContext } from '../../../context'
import type { ChangeEvent } from '../../../types'
import fs from 'node:fs'
import process from 'node:process'
import path from 'pathe'
import { configExtensions } from '../../../constants'
import logger from '../../../logger'
import { createFileWatcher } from '../../../runtime/watch/fileWatcher'
import { cleanupCssImporterGraph, extractCssImportDependencies } from './cssGraph'
import { defaultIgnoredDirNames, isSidecarFile, isWatchLimitError, watchedCssExts, watchedScriptModuleSuffixes, watchedTemplateExts } from './shared'
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
  const knownSidecarFiles = new Set<string>()
  const preReadyDeletedKnownFiles = new Set<string>()
  let closed = false
  let closing: Promise<void> | undefined
  const pending = new Set<Promise<void>>()
  const failures: unknown[] = []
  const delivery = { isActive: () => !closed }
  const observe = (task: Promise<void>) => {
    pending.add(task)
    void task.then(() => pending.delete(task), (error) => {
      pending.delete(task)
      failures.push(error)
      logger.warn(`[监听] 侧车更新失败：${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const handleSidecarChange = (event: ChangeEvent, filePath: string, ready: boolean) => {
    if (closed || !isSidecarFile(filePath)) {
      return
    }

    const ext = path.extname(filePath)
    const isCssFile = Boolean(ext && watchedCssExts.has(ext))
    const isTemplateFile = Boolean(ext && watchedTemplateExts.has(ext))
    const isConfigFile = configExtensions.some(suffix => filePath.endsWith(suffix))
    const isScriptModuleFile = watchedScriptModuleSuffixes.some(suffix => filePath.endsWith(suffix))
    const hasReverseImporters = Boolean(isTemplateFile || isScriptModuleFile)
      && (ctx.wxmlService?.getImporters(filePath).size ?? 0) > 0

    if (isCssFile && (event === 'create' || event === 'update')) {
      observe((async () => await extractCssImportDependencies(ctx, filePath))())
    }

    const isDeleteEvent = event === 'delete'
    const isOwnedByModuleGraph = event === 'update' && ctx.moduleGraphService?.hasModule?.(filePath) === true
    const shouldInvalidate = (event === 'create' && ready)
      || isDeleteEvent
      || (event === 'update' && (isCssFile || hasReverseImporters || isTemplateFile || isConfigFile))
    if (shouldInvalidate) {
      observe((async () => {
        if (isTemplateFile && event !== 'delete') {
          await ctx.wxmlService?.scan(filePath)
        }
        if (isOwnedByModuleGraph) {
          return
        }
        await invalidateEntryForSidecar(ctx, filePath, event, delivery)
        if (isCssFile && isDeleteEvent) {
          cleanupCssImporterGraph(ctx, filePath)
        }
      })())
      return
    }

    if (isCssFile && isDeleteEvent) {
      cleanupCssImporterGraph(ctx, filePath)
    }
  }

  // eslint-disable-next-line ts/no-use-before-define -- 同文件内 helper，保持对外导出顺序稳定
  const ignoredMatcher = createSidecarIgnoredMatcher(ctx, absRoot)

  const watcher = createFileWatcher(ctx.configService, absRoot, {
    ignoreInitial: false,
    persistent: true,
    stability: { threshold: 100, interval: 20 },
    recoverRenames: true,
    ignored: (file, stat) => ignoredMatcher(file) || Boolean(stat?.isFile() && !isSidecarFile(file)),
  })

  const forwardChange = (event: ChangeEvent, input: string, options?: { silent?: boolean }) => {
    if (closed || !input) {
      return
    }
    const normalizedPath = path.normalize(input)
    const wasKnown = knownSidecarFiles.has(normalizedPath)
    const isPreReadyAtomicRestore = event === 'create' && preReadyDeletedKnownFiles.has(normalizedPath)
    if (event === 'create' || event === 'update') {
      knownSidecarFiles.add(normalizedPath)
      preReadyDeletedKnownFiles.delete(normalizedPath)
    }
    else if (event === 'delete') {
      if (!isReady && wasKnown) {
        preReadyDeletedKnownFiles.add(normalizedPath)
      }
      knownSidecarFiles.delete(normalizedPath)
    }
    if (!options?.silent) {
      logger.info(`[watch:${event}] ${ctx.configService.relativeCwd(normalizedPath)}`)
    }
    handleSidecarChange(event, normalizedPath, isReady || isPreReadyAtomicRestore)
  }

  watcher.onChange((changes) => {
    for (const change of changes) {
      if (change.initial === false) {
        isReady = true
      }
      if (change.kind === 'file') {
        if (change.source === 'rename') {
          logger.info(`[watch:rename->${change.event}] ${ctx.configService.relativeCwd(change.file)}`)
          if (change.event === 'update') {
            handleSidecarChange('update', change.file, true)
            continue
          }
        }
        forwardChange(change.event, change.file, { silent: change.source === 'rename' })
      }
    }
  })
  void watcher.ready.then((readiness) => {
    isReady = readiness === 'ready'
  }).catch(error => logger.warn(`[监听] 侧车启动失败：${error instanceof Error ? error.message : String(error)}`))

  watcher.onError((error) => {
    if (!isWatchLimitError(error)) {
      return
    }
    const relativeRoot = ctx.configService.relativeCwd(absRoot)
    const code = error?.code ?? 'UNKNOWN'
    logger.warn(`[监听] ${relativeRoot} 监听数量达到上限 (${code})，侧车文件监听已停用`)
  })

  sidecarWatcherMap.set(absRoot, {
    close: () => {
      if (!closing) {
        closed = true
        const completion = Promise.withResolvers<void>()
        closing = completion.promise
        preReadyDeletedKnownFiles.clear()
        void (async () => {
          try {
            await watcher.close()
          }
          catch (error) {
            failures.unshift(error)
          }
          await Promise.allSettled([...pending])
          if (failures.length) {
            throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'Sidecar watcher cleanup failed', { cause: failures[0] })
          }
        })().then(completion.resolve, completion.reject)
      }
      return closing
    },
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
