import type chokidar from 'chokidar'
import type { ConfigService } from '../config/types'
import process from 'node:process'

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

  const envUsePolling = process.env.CHOKIDAR_USEPOLLING
  const envInterval = process.env.CHOKIDAR_INTERVAL
  const envBinaryInterval = process.env.CHOKIDAR_BINARY_INTERVAL

  const usePollingCandidate = chokidar?.usePolling
    ?? serverWatch?.usePolling
    ?? (envUsePolling === '1' || envUsePolling === 'true'
      ? true
      : envUsePolling === '0' || envUsePolling === 'false'
        ? false
        : undefined)
  const intervalCandidate = chokidar?.interval ?? serverWatch?.interval ?? (envInterval ? Number(envInterval) : undefined)
  const binaryIntervalCandidate = chokidar?.binaryInterval ?? serverWatch?.binaryInterval ?? (envBinaryInterval ? Number(envBinaryInterval) : undefined)

  return {
    usePolling: typeof usePollingCandidate === 'boolean' ? usePollingCandidate : undefined,
    interval: typeof intervalCandidate === 'number' && Number.isFinite(intervalCandidate) ? intervalCandidate : undefined,
    binaryInterval: typeof binaryIntervalCandidate === 'number' && Number.isFinite(binaryIntervalCandidate) ? binaryIntervalCandidate : undefined,
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
