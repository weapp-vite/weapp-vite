import type { CAC } from 'cac'
import { parse } from 'weapp-ide-cli'
import logger from '../../logger'

export function registerNpmCommand(cli: CAC) {
  cli
    .command('npm')
    .alias('build:npm')
    .alias('build-npm')
    .action(async () => {
      try {
        await parse(['build-npm', '-p'])
      }
      catch (error) {
        logger.error(error)
      }
    })
}
