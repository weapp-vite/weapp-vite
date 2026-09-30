import type { BuildTarget, MutableCompilerContext } from '../../context'
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
    logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
    throw new Error('请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
  }

  return {
    hasWorkersDir,
    workersDir,
  }
}
