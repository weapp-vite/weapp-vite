import type { RolldownWatcher } from 'rolldown'
import type { BuildTarget, MutableCompilerContext } from '../../context'
import fs from 'node:fs'
import chokidar from 'chokidar'
import path from 'pathe'
import { build } from 'vite'
import { logger } from '../../context/shared'

interface WorkerOptionsResult {
  hasWorkersDir: boolean
  workersDir: string | undefined
}

export function checkWorkersOptions(
  target: BuildTarget,
  configService: NonNullable<MutableCompilerContext['configService']>,
  scanService: NonNullable<MutableCompilerContext['scanService']>,
): WorkerOptionsResult {
  if (target === 'plugin') {
    return {
      hasWorkersDir: false,
      workersDir: undefined,
    }
  }
  const workersDir = scanService.workersDir
  const hasWorkersDir = Boolean(workersDir)
  if (hasWorkersDir && configService.weappViteConfig?.worker?.entry === undefined) {
    logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
    throw new Error('请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
  }

  return {
    hasWorkersDir,
    workersDir,
  }
}

export async function devWorkers(
  configService: NonNullable<MutableCompilerContext['configService']>,
  watcherService: NonNullable<MutableCompilerContext['watcherService']>,
  workersRoot: string,
) {
  const workersWatcher = (
    await build(
      configService.mergeWorkers(),
    )
  ) as unknown as RolldownWatcher
  watcherService.setRollupWatcher(workersWatcher, workersRoot)
}

export async function buildWorkers(
  configService: NonNullable<MutableCompilerContext['configService']>,
) {
  await build(
    configService.mergeWorkers(),
  )
}

export function watchWorkers(
  configService: NonNullable<MutableCompilerContext['configService']>,
  watcherService: NonNullable<MutableCompilerContext['watcherService']>,
  workersDir: string,
) {
  const absWorkerRoot = path.resolve(configService.absoluteSrcRoot, workersDir)
  const workerWatcher = chokidar.watch(
    absWorkerRoot,
    {
      persistent: true,
      ignoreInitial: true,
    },
  )

  const logWorkerEvent = (type: string, targetPath: string, level: 'info' | 'success' = 'info') => {
    if (!targetPath) {
      return
    }
    const relative = configService.relativeCwd(targetPath)
    const message = `[workers:${type}] ${relative}`
    if (level === 'success') {
      logger.success(message)
    }
    else {
      logger.info(message)
    }
  }

  workerWatcher.on('all', (event, id) => {
    if (!id) {
      return
    }
    if (event === 'add') {
      logWorkerEvent(event, id, 'success')
      void devWorkers(configService, watcherService, workersDir)
      return
    }
    logWorkerEvent(event, id)
  })

  workerWatcher.on('raw', (eventName, rawPath, details) => {
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
      ? (details as { watchedPath?: string }).watchedPath ?? absWorkerRoot
      : absWorkerRoot
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(baseDir, candidate)
    const exists = fs.existsSync(resolved)
    logWorkerEvent(exists ? 'rename->add' : 'rename->unlink', resolved, exists ? 'success' : 'info')
  })

  watcherService.sidecarWatcherMap.set(absWorkerRoot, {
    close: () => workerWatcher.close(),
  })
}
