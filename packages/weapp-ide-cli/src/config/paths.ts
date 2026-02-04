import os from 'node:os'
import path from 'pathe'

const homedir = os.homedir()

/**
 * @description 默认自定义配置目录
 */
export const defaultCustomConfigDirPath = path.join(homedir, '.weapp-ide-cli')

/**
 * @description 默认自定义配置文件路径
 */
export const defaultCustomConfigFilePath = path.join(
  defaultCustomConfigDirPath,
  'config.json',
)
