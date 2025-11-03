import type { CAC } from 'cac'
import { initConfig } from '@weapp-core/init'
import logger from '../../logger'

export function registerInitCommand(cli: CAC) {
  cli
    .command('init')
    .action(async () => {
      try {
        await initConfig({
          command: 'weapp-vite',
        })
      }
      catch (error) {
        logger.error(error)
      }
    })
}
