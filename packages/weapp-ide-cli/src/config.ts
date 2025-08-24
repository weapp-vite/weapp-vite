import type { BaseConfig } from './types'
import fs from 'fs-extra'

import {
  defaultCustomConfigFilePath,
  getDefaultPath,
} from './defaults'

import logger from './logger'

export function createCustomConfig(params: BaseConfig) {
  return fs.outputJSON(
    defaultCustomConfigFilePath,
    {
      cliPath: params.cliPath,
    },
    {
      encoding: 'utf8',
      spaces: 2,
    },
  )
}
export async function getConfig(): Promise<BaseConfig> {
  const isExisted = await fs.exists(defaultCustomConfigFilePath)
  if (isExisted) {
    const content = await fs.readFile(defaultCustomConfigFilePath, {
      encoding: 'utf8',
    })
    const config = JSON.parse(content)
    logger.log('> 全局配置文件路径：', defaultCustomConfigFilePath)
    logger.log('> 自定义cli路径：', config.cliPath)
    return config
  }
  else {
    return {
      cliPath: await getDefaultPath(),
    }
  }
}
