import type { ExecaError } from 'execa'
import logger from '../logger'
import { execute } from '../utils'

const MINIDEV_COMMAND = 'minidev'

function isCommandNotFound(error: unknown): error is ExecaError & { code: string } {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code: unknown }).code === 'ENOENT',
  )
}

/**
 * @description 运行支付宝小程序 CLI（minidev）
 */
export async function runMinidev(argv: readonly string[]) {
  try {
    await execute(MINIDEV_COMMAND, [...argv])
  }
  catch (error) {
    if (isCommandNotFound(error)) {
      logger.error('未检测到支付宝小程序 CLI：minidev')
      logger.log('请先安装 minidev，可使用以下任一命令：')
      logger.log('- pnpm add -g minidev')
      logger.log('- npm install -g minidev')
      logger.log('- yarn global add minidev')
      return
    }

    throw error
  }
}
