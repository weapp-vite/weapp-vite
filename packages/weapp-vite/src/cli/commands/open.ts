import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import { openIde, resolveIdeCommandContext } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const { platform, projectPath } = await resolveIdeCommandContext({
        configFile,
        mode: options.mode ?? 'development',
        platform: targets.mpPlatform,
        projectPath: root,
        cliPlatform: targets.rawPlatform,
      })

      await openIde(platform, projectPath)
    })
}
