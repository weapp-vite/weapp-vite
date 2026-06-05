import type { ProjectConfig } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

const TRAILING_SLASH_RE = /\/+$/u
const LEADING_DOT_SLASH_RE = /^\.\//u

function normalizeRelativeDir(value: string) {
  const normalized = value
    .replaceAll('\\', '/')
    .replace(LEADING_DOT_SLASH_RE, '')
    .replace(TRAILING_SLASH_RE, '')
  return normalized || '.'
}

function isSafeRelativeDir(value: unknown) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !path.isAbsolute(value)
    && !value.split(/[\\/]+/u).includes('..')
}

async function hasAppJson(root: string, srcRoot: string) {
  return await fs.pathExists(path.resolve(root, srcRoot, 'app.json'))
}

function pushCandidate(candidates: string[], value: unknown) {
  if (!isSafeRelativeDir(value)) {
    return
  }
  const normalized = normalizeRelativeDir(value)
  if (!candidates.includes(normalized)) {
    candidates.push(normalized)
  }
}

/**
 * @description 根据原生小程序项目配置推断源码根目录。
 */
export async function resolveProjectSrcRoot(root: string, projectConfig?: ProjectConfig | null) {
  const candidates: string[] = []
  pushCandidate(candidates, projectConfig?.srcMiniprogramRoot)
  pushCandidate(candidates, projectConfig?.miniprogramRoot)
  pushCandidate(candidates, '.')
  pushCandidate(candidates, 'src')
  pushCandidate(candidates, 'miniprogram')

  for (const candidate of candidates) {
    if (await hasAppJson(root, candidate)) {
      return candidate
    }
  }

  return 'src'
}
