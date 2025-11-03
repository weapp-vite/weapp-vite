import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

export function registerBuildCommand(cli: CAC) {
  cli
    .command('build [root]', 'build for production')
    .option('--target <target>', `[string] transpile target (default: 'modules')`)
    .option('--outDir <dir>', `[string] output directory (default: dist)`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option(
      '--sourcemap [output]',
      `[boolean | "inline" | "hidden"] output source maps for build (default: false)`,
    )
    .option(
      '--minify [minifier]',
      `[boolean | "terser" | "esbuild"] enable/disable minification, `
      + `or specify minifier to use (default: esbuild)`,
    )
    .option(
      '--emptyOutDir',
      `[boolean] force empty outDir when it's outside of root`,
    )
    .option('-w, --watch', `[boolean] rebuilds when modules have changed on disk`)
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      logRuntimeTarget(targets)
      const inlineConfig = createInlineConfig(targets.mpPlatform)
      const { buildService, configService, webService } = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'production',
        configFile,
        inlineConfig,
      })
      if (targets.runMini) {
        await buildService.build(options)
      }
      const webConfig = configService.weappWebConfig
      if (targets.runWeb && webConfig?.enabled) {
        try {
          await webService?.build()
          logger.success(`Web 构建完成，输出目录：${configService.relativeCwd(webConfig.outDir)}`)
        }
        catch (error) {
          logger.error(error)
          throw error
        }
      }
      if (targets.runMini) {
        logBuildAppFinish(configService, undefined, { skipWeb: !targets.runWeb })
      }
      if (options.open && targets.runMini) {
        await openIde()
      }
    })
}
