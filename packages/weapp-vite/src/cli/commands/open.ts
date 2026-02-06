import type { CAC } from 'cac'
import { openIde, resolveIdeProjectPath } from '../openIde'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (root: string | undefined, options: { platform?: string, p?: string }) => {
      const targets = resolveRuntimeTargets(options)
      const defaultProjectPath = targets.mpPlatform === 'alipay'
        ? resolveIdeProjectPath('dist/alipay/dist')
        : undefined
      const projectPath = root || defaultProjectPath
      await openIde(targets.mpPlatform, projectPath)
    })
}
