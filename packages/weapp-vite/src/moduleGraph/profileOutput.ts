import type { ConfigService } from '../runtime/config/types'
import process from 'node:process'
import path from 'pathe'
import { resolveActiveHmrProfileJsonPath } from '../utils/hmrProfile'
import { normalizePath } from '../utils/path'

/** 仅识别当前启用的自身 profile 文件，不屏蔽同目录或同名用户输入。 */
export function createProfileOutputMatcher(configService?: Pick<ConfigService, 'cwd' | 'weappViteConfig'>) {
  return (file: string) => {
    if (!configService) {
      return false
    }
    const output = resolveActiveHmrProfileJsonPath({
      cwd: configService.cwd,
      option: configService.weappViteConfig?.hmr?.profileJson,
    })
    if (!output) {
      return false
    }
    const normalize = (value: string) => {
      const normalized = normalizePath(path.resolve(configService.cwd, normalizePath(value)))
      return process.platform === 'win32' ? normalized.toLowerCase() : normalized
    }
    return normalize(file) === normalize(output)
  }
}
