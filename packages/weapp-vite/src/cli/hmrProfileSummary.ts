import type { WeappViteConfig } from '../types'
import { fs } from '@weapp-core/shared/fs'
import { resolveHmrProfileJsonPath } from '../utils/hmrProfile'

export interface HmrLatestProfileSummary {
  file?: string
  line: string
  profilePath: string
}

interface HmrProfileJsonSample {
  totalMs?: number
  event?: string
  file?: string
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
}

interface ReadLatestHmrProfileSummaryOptions {
  cwd: string
  relativeCwd?: (value: string) => string
  weappViteConfig?: WeappViteConfig
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseLatestHmrProfileSample(content: string) {
  const lines = content.split(/\r?\n/)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index]?.trim()
    if (!trimmed) {
      continue
    }
    try {
      const parsed = JSON.parse(trimmed) as HmrProfileJsonSample
      if (isFiniteNumber(parsed.totalMs)) {
        return parsed
      }
    }
    catch {
      continue
    }
  }
  return undefined
}

function formatPhaseHint(sample: HmrProfileJsonSample) {
  const phases = [
    {
      label: 'watch->dirty',
      value: sample.watchToDirtyMs,
    },
    {
      label: 'emit',
      value: sample.emitMs,
    },
    {
      label: 'shared',
      value: sample.sharedChunkResolveMs,
    },
  ]
    .filter(phase => isFiniteNumber(phase.value))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  const topPhase = phases[0]
  if (!topPhase || (topPhase.value ?? 0) < 5) {
    return undefined
  }
  return `${topPhase.label} ${topPhase.value!.toFixed(2)} ms`
}

/**
 * @description 读取最近一次 HMR profile，并格式化为 IDE 日志启动前的单行摘要。
 */
export async function readLatestHmrProfileSummary(
  options: ReadLatestHmrProfileSummaryOptions,
): Promise<HmrLatestProfileSummary | undefined> {
  const profilePath = resolveHmrProfileJsonPath({
    cwd: options.cwd,
    option: options.weappViteConfig?.hmr?.profileJson,
  })
  if (!profilePath) {
    return undefined
  }

  const content = await fs.readFile(profilePath, 'utf8').catch(() => undefined)
  if (!content) {
    return undefined
  }

  const sample = parseLatestHmrProfileSample(content)
  if (!sample || !isFiniteNumber(sample.totalMs)) {
    return undefined
  }

  const relativeCwd = options.relativeCwd ?? (value => value)
  const segments = [
    `[hmr] 最近一次热更新 ${sample.totalMs.toFixed(2)} ms`,
  ]
  if (sample.event) {
    segments.push(sample.event)
  }
  if (sample.file) {
    segments.push(relativeCwd(sample.file))
  }
  const phaseHint = formatPhaseHint(sample)
  if (phaseHint) {
    segments.push(`主耗时 ${phaseHint}`)
  }

  return {
    file: sample.file,
    profilePath,
    line: segments.join('，'),
  }
}
