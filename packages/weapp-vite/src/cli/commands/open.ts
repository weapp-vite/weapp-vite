import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { openIde, resolveIdeCommandContext, resolveIdeProjectRoot } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const { platform, projectPath, mpDistRoot } = await resolveIdeCommandContext({
        configFile,
        mode: options.mode ?? 'development',
        platform: targets.mpPlatform,
        projectPath: root,
        cliPlatform: targets.rawPlatform,
      })

      await openIde(platform, projectPath ?? resolveIdeProjectRoot(mpDistRoot, process.cwd()), {
        trustProject: options.trustProject,
      })
    })
}
