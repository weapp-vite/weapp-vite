import type { ConfigService } from '../config/types'

interface SidecarWatchOptionsInput {
  persistent?: boolean
  ignoreInitial?: boolean
  ignored?: unknown
  awaitWriteFinish?: {
    stabilityThreshold?: number
    pollInterval?: number
  }
}

function resolvePollingWatchConfig(configService: Pick<ConfigService, 'inlineConfig'>) {
  const buildWatch = configService.inlineConfig?.build?.watch
  const chokidar = buildWatch && typeof buildWatch === 'object' && 'chokidar' in buildWatch
    ? (buildWatch as { chokidar?: Record<string, unknown> }).chokidar
    : undefined
  const serverWatch = configService.inlineConfig?.server?.watch

  const usePolling = chokidar?.usePolling ?? serverWatch?.usePolling
  const interval = chokidar?.interval ?? serverWatch?.interval
  const binaryInterval = chokidar?.binaryInterval ?? serverWatch?.binaryInterval

  return {
    usePolling,
    interval,
    binaryInterval,
  }
}

export function createSidecarWatchOptions(
  configService: Pick<ConfigService, 'inlineConfig'>,
  input: SidecarWatchOptionsInput,
) {
  const polling = resolvePollingWatchConfig(configService)

  return {
    ...input,
    ...(polling.usePolling !== undefined ? { usePolling: polling.usePolling } : {}),
    ...(typeof polling.interval === 'number' ? { interval: polling.interval } : {}),
    ...(typeof polling.binaryInterval === 'number' ? { binaryInterval: polling.binaryInterval } : {}),
  }
}
