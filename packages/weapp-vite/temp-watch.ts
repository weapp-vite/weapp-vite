import process from 'node:process'
import { createCompilerContext } from './src/createContext'
import logger from './src/logger'
import { getFixture } from './test/utils'

async function main() {
  const ctx = await createCompilerContext({
    cwd: getFixture('watch-no-subpackage'),
    isDev: true,
  })
  logger.info('watch context ready')
  const watcher = await ctx.buildService.build({ skipNpm: true })
  logger.info('build resolved', typeof (watcher as any)?.on)
  await (watcher as any)?.close?.()
  ctx.watcherService?.closeAll()
}

main().catch((err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)))
  process.exit(1)
})
