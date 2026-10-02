import type { BuildTarget, MutableCompilerContext } from '../../context'
import type { AppEntry } from '../../types'
import { logger } from '../../context/shared'

interface WorkerOptionsResult {
  hasWorkersDir: boolean
  workersDir: string | undefined
}

function checkWorkersDir(
  target: BuildTarget,
  configService: NonNullable<MutableCompilerContext['configService']>,
  workersDir: string | undefined,
): WorkerOptionsResult {
  if (target === 'plugin') {
    return {
      hasWorkersDir: false,
      workersDir: undefined,
    }
  }
  const hasWorkersDir = Boolean(workersDir)
  if (hasWorkersDir && configService.weappViteConfig?.worker?.entry === undefined) {
    logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
    throw new Error('请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
  }

  return {
    hasWorkersDir,
    workersDir,
  }
}

export function checkWorkersOptions(
  target: BuildTarget,
  configService: NonNullable<MutableCompilerContext['configService']>,
  scanService: NonNullable<MutableCompilerContext['scanService']>,
): WorkerOptionsResult {
  return checkWorkersDir(target, configService, scanService.workersDir)
}

/** 校验本次扫描返回的配置，不能重读可能已被 watchChange 失效的共享扫描状态。 */
export function checkAppWorkersOptions(
  target: BuildTarget,
  configService: NonNullable<MutableCompilerContext['configService']>,
  app: Pick<AppEntry, 'json'>,
): WorkerOptionsResult {
  const workers = app.json?.workers
  return checkWorkersDir(target, configService, typeof workers === 'object' ? workers?.path : workers)
}
