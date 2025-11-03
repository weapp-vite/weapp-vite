import type { CAC } from 'cac'
import type { ViteDevServer } from 'vite'
import type { GlobalCLIOptions } from '../types'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // default command
    .alias('serve') // the command is called 'serve' in Vite's API
    .alias('dev') // alias to align with the script name
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      logRuntimeTarget(targets)
      const inlineConfig = createInlineConfig(targets.mpPlatform)
      const { buildService, configService, webService } = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'development',
        isDev: true,
        configFile,
        inlineConfig,
      })
      if (targets.runMini) {
        await buildService.build(options)
      }
      let webServer: ViteDevServer | undefined
      if (targets.runWeb) {
        try {
          webServer = await webService?.startDevServer()
        }
        catch (error) {
          logger.error(error)
          throw error
        }
      }
      if (targets.runMini) {
        logBuildAppFinish(configService, webServer, { skipWeb: !targets.runWeb })
      }
      else if (targets.runWeb) {
        logBuildAppFinish(configService, webServer, { skipMini: true })
      }
      if (options.open && targets.runMini) {
        await openIde()
      }
    })
}
