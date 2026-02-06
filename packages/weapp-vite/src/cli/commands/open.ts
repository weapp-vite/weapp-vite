import type { CAC } from 'cac'
import { openIde } from '../openIde'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (options: { platform?: string, p?: string }) => {
      const targets = resolveRuntimeTargets(options)
      await openIde(targets.mpPlatform)
    })
}
