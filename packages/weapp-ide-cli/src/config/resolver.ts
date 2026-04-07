import type { ResolvedConfig } from '../types'
import { fs } from '@weapp-core/shared'
import logger, { colors } from '../logger'
import { getDefaultCliPath } from '../runtime/platform'
import { readCustomConfig } from './custom'
import { defaultCustomConfigFilePath } from './paths'

interface CustomConfigJson {
  cliPath?: unknown
  locale?: unknown
}

function isCustomConfigJson(value: unknown): value is CustomConfigJson {
  return typeof value === 'object' && value !== null
}

/**
 * @description 读取并解析 CLI 配置（自定义优先）
 */
export async function getConfig(): Promise<ResolvedConfig> {
  if (await fs.pathExists(defaultCustomConfigFilePath)) {
    try {
      const rawConfig = await fs.readJSON(defaultCustomConfigFilePath)
      const config = isCustomConfigJson(rawConfig) ? rawConfig : {}
      const cliPath = typeof config.cliPath === 'string' ? config.cliPath.trim() : ''
      const locale = config.locale === 'zh' || config.locale === 'en' ? config.locale : undefined

      if (cliPath) {
        logger.info(`全局配置文件路径：${colors.green(defaultCustomConfigFilePath)}`)
        logger.info(`自定义 CLI 路径：${colors.green(cliPath)}`)
        return {
          cliPath,
          locale,
          source: 'custom',
        }
      }

      logger.warn('自定义配置文件缺少有效的 CLI 路径，将尝试使用默认路径。')
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      logger.warn(`解析自定义配置失败，将尝试使用默认路径。原因：${reason}`)
    }
  }

  const fallbackPath = await getDefaultCliPath()

  if (fallbackPath) {
    return {
      cliPath: fallbackPath,
      locale: undefined,
      source: 'default',
    }
  }

  return {
    cliPath: '',
    locale: undefined,
    source: 'missing',
  }
}

/**
 * @description 获取用户配置的语言偏好。
 */
export async function getConfiguredLocale() {
  const config = await readCustomConfig()
  return config.locale
}
