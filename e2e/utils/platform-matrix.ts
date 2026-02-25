import process from 'node:process'

export interface ResolvePlatformMatrixOptions<T extends string> {
  /**
   * 本地默认平台（未指定 E2E_PLATFORM 时生效）
   */
  localDefault?: T | readonly T[]
}

function isCiRuntime() {
  return process.env.CI === '1' || process.env.CI === 'true'
}

function isFullMatrixRequested() {
  return process.env.E2E_FULL_MATRIX === '1'
}

/**
 * 解析 e2e 平台矩阵：
 * 1) 显式设置 E2E_PLATFORM 时，仅跑该平台；
 * 2) CI 或 E2E_FULL_MATRIX=1 时，跑完整平台列表；
 * 3) 其余本地场景，默认跑 localDefault（未传则取首个平台）。
 */
export function resolvePlatformMatrix<T extends string>(
  supportedPlatforms: readonly T[],
  options: ResolvePlatformMatrixOptions<T> = {},
): T[] {
  if (supportedPlatforms.length === 0) {
    return []
  }

  const selected = process.env.E2E_PLATFORM
  if (selected) {
    if (!supportedPlatforms.includes(selected as T)) {
      throw new Error(`Unsupported E2E_PLATFORM: ${selected}. Supported: ${supportedPlatforms.join(', ')}`)
    }
    return [selected as T]
  }

  if (isCiRuntime() || isFullMatrixRequested()) {
    return [...supportedPlatforms]
  }

  const localDefaults = options.localDefault
    ? (Array.isArray(options.localDefault) ? [...options.localDefault] : [options.localDefault])
    : [supportedPlatforms[0]]

  for (const platform of localDefaults) {
    if (!supportedPlatforms.includes(platform)) {
      throw new Error(`Invalid local default platform: ${platform}. Supported: ${supportedPlatforms.join(', ')}`)
    }
  }

  return [...localDefaults]
}
