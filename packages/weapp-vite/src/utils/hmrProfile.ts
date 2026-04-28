import process from 'node:process'
import path from 'pathe'

export const DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH = '.weapp-vite/hmr-profile.jsonl'
export const HMR_PROFILE_JSON_ENV = 'WEAPP_VITE_HMR_PROFILE_JSON'
export type HmrProfileDurationKey = 'transformMs' | 'writeMs'

interface ResolveHmrProfileJsonPathOptions {
  cwd: string
  option?: boolean | string
  fallbackToDefault?: boolean
}

/**
 * @description 解析 HMR profile JSONL 输出路径。
 */
export function resolveHmrProfileJsonPath(options: ResolveHmrProfileJsonPathOptions) {
  const fallbackToDefault = options.fallbackToDefault ?? false
  if (options.option === true) {
    return path.join(options.cwd, DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH)
  }
  if (typeof options.option === 'string') {
    const trimmed = options.option.trim()
    if (trimmed) {
      return path.isAbsolute(trimmed)
        ? trimmed
        : path.resolve(options.cwd, trimmed)
    }
  }
  if (fallbackToDefault) {
    return path.join(options.cwd, DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH)
  }
  return undefined
}

/**
 * @description 从环境变量解析 HMR profile JSONL 输出选项。
 */
export function resolveHmrProfileJsonEnvOption(env: NodeJS.ProcessEnv = process.env): boolean | string | undefined {
  const raw = env[HMR_PROFILE_JSON_ENV]?.trim()
  if (!raw) {
    return undefined
  }
  if (raw === '1' || raw.toLowerCase() === 'true') {
    return true
  }
  if (raw === '0' || raw.toLowerCase() === 'false') {
    return undefined
  }
  return raw
}

let hmrProfileEventSequence = 0

/**
 * @description 创建 HMR profile 事件 id，用于把 watcher 事件、JSONL 样本和外部审计场景稳定关联。
 */
export function createHmrProfileEventId() {
  hmrProfileEventSequence += 1
  return `${Date.now().toString(36)}-${hmrProfileEventSequence.toString(36)}`
}

/**
 * @description 为 HMR profile 累加阶段耗时。
 */
export function recordHmrProfileDuration(
  profile: Partial<Record<HmrProfileDurationKey, number | undefined>> | undefined,
  key: HmrProfileDurationKey,
  durationMs: number,
) {
  if (!profile || !Number.isFinite(durationMs) || durationMs <= 0) {
    return
  }
  profile[key] = (profile[key] ?? 0) + durationMs
}
