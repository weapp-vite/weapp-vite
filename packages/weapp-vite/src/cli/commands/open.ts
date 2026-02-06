import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { createCompilerContext } from '../../createContext'
import { openIde, resolveIdeProjectPath } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)

      let platform = targets.mpPlatform
      let projectPath = root

      if (targets.runMini && (!platform || !projectPath)) {
        try {
          const ctx = await createCompilerContext({
            cwd: process.cwd(),
            mode: options.mode ?? 'development',
            configFile,
            inlineConfig: createInlineConfig(platform),
            cliPlatform: targets.rawPlatform,
          })
          platform ??= ctx.configService.platform
          if (!projectPath) {
            projectPath = resolveIdeProjectPath(ctx.configService.mpDistRoot)
          }
        }
        catch {
          // 忽略配置加载失败，回退到静态推导
        }
      }

      if (!projectPath && platform === 'alipay') {
        projectPath = resolveIdeProjectPath('dist/alipay/dist')
      }

      await openIde(platform, projectPath)
    })
}
