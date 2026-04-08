import type chokidar from 'chokidar'
import type { ConfigService } from '../config/types'

type ChokidarWatchOptions = NonNullable<Parameters<typeof chokidar.watch>[1]>

interface SidecarWatchOptionsInput {
  persistent?: boolean
  ignoreInitial?: boolean
  ignored?: ChokidarWatchOptions['ignored']
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

  const usePollingCandidate = chokidar?.usePolling ?? serverWatch?.usePolling
  const intervalCandidate = chokidar?.interval ?? serverWatch?.interval
  const binaryIntervalCandidate = chokidar?.binaryInterval ?? serverWatch?.binaryInterval

  return {
    usePolling: typeof usePollingCandidate === 'boolean' ? usePollingCandidate : undefined,
    interval: typeof intervalCandidate === 'number' ? intervalCandidate : undefined,
    binaryInterval: typeof binaryIntervalCandidate === 'number' ? binaryIntervalCandidate : undefined,
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
  } as ChokidarWatchOptions
}
