import type chokidar from 'chokidar'
import type { Matcher } from 'vite'
import type { ConfigService } from '../config/types'
import process from 'node:process'
import path from 'pathe'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

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

/**
 * 解析主 watcher 与 sidecar watcher 共享的轮询配置。
 */
function resolveWatchBackend(configService: Pick<ConfigService, 'inlineConfig'>) {
  const buildWatch = configService.inlineConfig?.build?.watch
  const chokidar = buildWatch && typeof buildWatch === 'object' && 'chokidar' in buildWatch
    ? (buildWatch as { chokidar?: Record<string, unknown> }).chokidar
    : undefined
  const serverWatch = configService.inlineConfig?.server?.watch as Record<string, unknown> | undefined

  const envUsePolling = process.env.CHOKIDAR_USEPOLLING
  const envInterval = process.env.CHOKIDAR_INTERVAL
  const envBinaryInterval = process.env.CHOKIDAR_BINARY_INTERVAL

  const backendFrom = (source?: Record<string, unknown>) => {
    const backend = source?.backend
    if (backend === 'auto' || backend === 'native' || backend === 'native-recursive' || backend === 'polling') {
      return backend
    }
    return typeof source?.usePolling === 'boolean' ? (source.usePolling ? 'polling' : 'native') : undefined
  }
  const backend = backendFrom(chokidar) ?? backendFrom(serverWatch)
    ?? (envUsePolling === '1' || envUsePolling === 'true'
      ? 'polling'
      : envUsePolling === '0' || envUsePolling === 'false'
        ? 'native'
        : undefined)
  const intervalCandidate = chokidar?.pollingInterval ?? chokidar?.interval
    ?? serverWatch?.pollingInterval ?? serverWatch?.interval ?? (envInterval ? Number(envInterval) : undefined)
  const binaryIntervalCandidate = chokidar?.pollingBinaryInterval ?? chokidar?.binaryInterval
    ?? serverWatch?.pollingBinaryInterval ?? serverWatch?.binaryInterval ?? (envBinaryInterval ? Number(envBinaryInterval) : undefined)

  return {
    backend,
    interval: typeof intervalCandidate === 'number' && Number.isFinite(intervalCandidate) ? intervalCandidate : undefined,
    binaryInterval: typeof binaryIntervalCandidate === 'number' && Number.isFinite(binaryIntervalCandidate) ? binaryIntervalCandidate : undefined,
  }
}

/** 为 Vite 内置监听器保留兼容选项。 */
export function resolvePollingWatchOptions(configService: Pick<ConfigService, 'inlineConfig'>) {
  const { backend, interval, binaryInterval } = resolveWatchBackend(configService)
  return {
    usePolling: backend === 'polling'
      ? true
      : backend !== undefined
        ? false
        : undefined,
    interval,
    binaryInterval,
  }
}

export function createSidecarWatchOptions(
  configService: Pick<ConfigService, 'inlineConfig'>,
  input: SidecarWatchOptionsInput,
) {
  const polling = resolveWatchBackend(configService)

  return {
    ...input,
    ...(polling.backend !== undefined ? { backend: polling.backend } : {}),
    ...(typeof polling.interval === 'number' ? { pollingInterval: polling.interval } : {}),
    ...(typeof polling.binaryInterval === 'number' ? { pollingBinaryInterval: polling.binaryInterval } : {}),
  } as ChokidarWatchOptions
}

/**
 * 合并用户配置并排除 Vite 开发服务器不应监听的构建输出目录。
 */
export function createViteWatchIgnored(
  root: string,
  outDir: string,
  ignored?: Matcher,
): Matcher {
  const normalizedRoot = normalizeFsResolvedId(root)
  const normalizedOutDir = normalizeFsResolvedId(
    path.isAbsolute(outDir) ? outDir : path.resolve(root, outDir),
  )
  const patterns = ignored === undefined ? [] : Array.isArray(ignored) ? ignored : [ignored]

  return [
    ...patterns,
    (id: string) => {
      const normalizedId = normalizeFsResolvedId(
        path.isAbsolute(id) ? id : path.resolve(normalizedRoot, id),
      )
      return isPathInside(normalizedOutDir, normalizedId)
    },
  ]
}
