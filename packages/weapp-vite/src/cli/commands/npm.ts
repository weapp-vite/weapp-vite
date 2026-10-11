import type { CAC } from 'cac'
import process from 'node:process'
import logger from '../../logger'

export function registerNpmCommand(cli: CAC) {
  cli
    .command('npm')
    .alias('build:npm')
    .alias('build-npm')
    .action(async () => {
      try {
        const { buildWechatIdeNpm } = await import('weapp-ide-cli')
        await buildWechatIdeNpm({
          projectPath: process.cwd(),
        })
      }
      catch (error) {
        logger.error(error)
      }
    })
}
