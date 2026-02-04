import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import fs from 'fs-extra'
import { createCustomConfig } from '../config/custom'
import { defaultCustomConfigFilePath } from '../config/paths'
import logger from '../logger'

/**
 * @description 交互式提示并保存 CLI 路径
 */
export async function promptForCliPath() {
  const rl = createInterface({ input, output })
  try {
    logger.log('请设置微信web开发者工具 CLI 的路径')
    logger.log('> 提示：命令行工具默认所在位置：')
    logger.log('- MacOS: <安装路径>/Contents/MacOS/cli')
    logger.log('- Windows: <安装路径>/cli.bat')
    logger.log('- Linux: <安装路径>/files/bin/bin/wechat-devtools-cli')

    const cliPath = (await rl.question('请输入微信web开发者工具 CLI 路径：')).trim()

    if (!cliPath) {
      logger.error('路径不能为空，已取消本次配置。')
      return null
    }

    try {
      const normalizedPath = await createCustomConfig({ cliPath })
      logger.log(`全局配置存储位置：${defaultCustomConfigFilePath}`)

      if (!(await fs.pathExists(normalizedPath))) {
        logger.warn('在当前路径未找到微信web开发者命令行工具，请确认路径是否正确。')
      }

      return normalizedPath
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      logger.error(`保存配置失败：${reason}`)
      return null
    }
  }
  finally {
    rl.close()
  }
}
