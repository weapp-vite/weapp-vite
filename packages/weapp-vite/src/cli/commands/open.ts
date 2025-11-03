import type { CAC } from 'cac'
import { openIde } from '../openIde'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open')
    .action(async () => {
      await openIde()
    })
}
