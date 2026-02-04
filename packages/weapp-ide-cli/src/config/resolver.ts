import type { ResolvedConfig } from '../types'
import fs from 'fs-extra'
import logger from '../logger'
import { getDefaultCliPath } from '../runtime/platform'
import { defaultCustomConfigFilePath } from './paths'

/**
 * @description 读取并解析 CLI 配置（自定义优先）
 */
export async function getConfig(): Promise<ResolvedConfig> {
  if (await fs.pathExists(defaultCustomConfigFilePath)) {
    try {
      const config = await fs.readJSON(defaultCustomConfigFilePath)
      const cliPath = typeof config.cliPath === 'string' ? config.cliPath.trim() : ''

      if (cliPath) {
        logger.log('> 全局配置文件路径：', defaultCustomConfigFilePath)
        logger.log('> 自定义 CLI 路径：', cliPath)
        return {
          cliPath,
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
      source: 'default',
    }
  }

  return {
    cliPath: '',
    source: 'missing',
  }
}
