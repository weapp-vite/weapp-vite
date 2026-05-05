import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import logger from '../../logger'
import { readLatestHmrProfileSummary } from '../hmrProfileSummary'
import { openIde, resolveIdeCommandContext, resolveIdeProjectRoot } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | web)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const { cwd, platform, projectPath, mpDistRoot, weappViteConfig } = await resolveIdeCommandContext({
        configFile,
        mode: options.mode ?? 'development',
        platform: targets.platform,
        projectPath: root,
        cliPlatform: targets.rawPlatform,
      })
      const latestHmrSummary = await readLatestHmrProfileSummary({
        cwd: cwd ?? process.cwd(),
        relativeCwd: value => cwd ? value.replace(`${cwd}/`, '') : value,
        weappViteConfig,
      })
      if (latestHmrSummary) {
        logger.info(latestHmrSummary.line)
      }

      await openIde(platform, projectPath ?? resolveIdeProjectRoot(mpDistRoot, process.cwd()), {
        trustProject: options.trustProject,
      })
    })
}
