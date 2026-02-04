import type { BaseConfig } from '../types'
import fs from 'fs-extra'
import { resolvePath } from '../utils/path'
import { defaultCustomConfigDirPath, defaultCustomConfigFilePath } from './paths'

const JSON_OPTIONS = {
  encoding: 'utf8',
  spaces: 2,
} as const

/**
 * @description 写入自定义 CLI 路径配置
 */
export async function createCustomConfig(params: BaseConfig) {
  const trimmedCliPath = params.cliPath.trim()

  if (!trimmedCliPath) {
    throw new Error('cliPath cannot be empty')
  }

  const normalizedCliPath = resolvePath(trimmedCliPath)

  await fs.ensureDir(defaultCustomConfigDirPath)
  await fs.writeJSON(
    defaultCustomConfigFilePath,
    {
      cliPath: normalizedCliPath,
    },
    JSON_OPTIONS,
  )

  return normalizedCliPath
}
