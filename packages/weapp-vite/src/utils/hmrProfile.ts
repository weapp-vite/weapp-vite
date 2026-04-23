import path from 'pathe'

export const DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH = '.weapp-vite/hmr-profile.jsonl'

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
