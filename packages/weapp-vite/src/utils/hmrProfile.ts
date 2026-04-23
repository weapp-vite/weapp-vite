import path from 'pathe'

export const DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH = '.weapp-vite/hmr-profile.jsonl'
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
