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
export function resolvePollingWatchOptions(configService: Pick<ConfigService, 'inlineConfig'>) {
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
  const polling = resolvePollingWatchOptions(configService)

  return {
    ...input,
    ...(polling.usePolling !== undefined ? { usePolling: polling.usePolling } : {}),
    ...(typeof polling.interval === 'number' ? { interval: polling.interval } : {}),
    ...(typeof polling.binaryInterval === 'number' ? { binaryInterval: polling.binaryInterval } : {}),
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
