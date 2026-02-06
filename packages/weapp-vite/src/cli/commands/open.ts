import type { CAC } from 'cac'
import { openIde } from '../openIde'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (root: string | undefined, options: { platform?: string, p?: string }) => {
      const targets = resolveRuntimeTargets(options)
      const projectPath = root || (targets.mpPlatform === 'alipay'
        ? 'dist/alipay'
        : undefined)
      await openIde(targets.mpPlatform, projectPath)
    })
}
