import type { CAC } from 'cac'
import logger from '../../logger'
import { executeWechatIdeCliCommand } from '../openIde/execute'

export function registerNpmCommand(cli: CAC) {
  cli
    .command('npm')
    .alias('build:npm')
    .alias('build-npm')
    .action(async () => {
      try {
        await executeWechatIdeCliCommand(['build-npm', '-p'])
      }
      catch (error) {
        logger.error(error)
      }
    })
}
