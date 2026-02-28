import type { BaseConfig } from '../types'
import fs from 'fs-extra'
import { resolvePath } from '../utils/path'
import { defaultCustomConfigDirPath, defaultCustomConfigFilePath } from './paths'

const JSON_OPTIONS = {
  encoding: 'utf8',
  spaces: 2,
} as const

interface CustomConfigFile {
  cliPath?: string
  locale?: 'zh' | 'en'
}

/**
 * @description 写入自定义 CLI 路径配置
 */
export async function createCustomConfig(params: BaseConfig) {
  const trimmedCliPath = params.cliPath.trim()

  if (!trimmedCliPath) {
    throw new Error('cliPath cannot be empty')
  }

  const normalizedCliPath = resolvePath(trimmedCliPath)

  await writeCustomConfig({
    cliPath: normalizedCliPath,
  })

  return normalizedCliPath
}

/**
 * @description 写入语言配置（zh / en）。
 */
export async function createLocaleConfig(locale: 'zh' | 'en') {
  await writeCustomConfig({ locale })
  return locale
}

/**
 * @description 删除指定配置项。
 */
export async function removeCustomConfigKey(key: keyof CustomConfigFile) {
  const currentConfig = await readCustomConfig()
  if (!(key in currentConfig)) {
    return
  }

  const nextConfig: CustomConfigFile = { ...currentConfig }
  delete nextConfig[key]
  await writeCustomConfig(nextConfig, { replace: true })
}

/**
 * @description 覆盖写入配置内容（会替换原内容）。
 */
export async function overwriteCustomConfig(config: CustomConfigFile) {
  const nextConfig: CustomConfigFile = {}

  if (typeof config.cliPath === 'string' && config.cliPath.trim()) {
    nextConfig.cliPath = resolvePath(config.cliPath.trim())
  }

  if (config.locale === 'zh' || config.locale === 'en') {
    nextConfig.locale = config.locale
  }

  await writeCustomConfig(nextConfig, { replace: true })
}

/**
 * @description 读取原始自定义配置。
 */
export async function readCustomConfig(): Promise<CustomConfigFile> {
  if (!(await fs.pathExists(defaultCustomConfigFilePath))) {
    return {}
  }

  try {
    const config = await fs.readJSON(defaultCustomConfigFilePath)
    if (!config || typeof config !== 'object') {
      return {}
    }

    const candidate = config as { cliPath?: unknown, locale?: unknown }
    const next: CustomConfigFile = {}

    if (typeof candidate.cliPath === 'string' && candidate.cliPath.trim()) {
      next.cliPath = candidate.cliPath.trim()
    }

    if (candidate.locale === 'zh' || candidate.locale === 'en') {
      next.locale = candidate.locale
    }

    return next
  }
  catch {
    return {}
  }
}

async function writeCustomConfig(patch: CustomConfigFile, options: { replace?: boolean } = {}) {
  const currentConfig = options.replace ? {} : await readCustomConfig()
  const nextConfig = { ...currentConfig, ...patch }

  await fs.ensureDir(defaultCustomConfigDirPath)
  await fs.writeJSON(defaultCustomConfigFilePath, nextConfig, JSON_OPTIONS)
}
