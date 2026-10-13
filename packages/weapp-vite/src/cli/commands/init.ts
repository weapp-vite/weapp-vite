import type { CAC } from 'cac'
import logger from '../../logger'

export function registerInitCommand(cli: CAC) {
  cli
    .command('init')
    .action(async () => {
      try {
        const { initConfig } = await import('@weapp-core/init')
        await initConfig({
          command: 'weapp-vite',
        })
      }
      catch (error) {
        logger.error(error)
      }
    })
}
