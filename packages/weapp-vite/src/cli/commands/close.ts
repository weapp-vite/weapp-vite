import type { CAC } from 'cac'
import { closeIde } from '../openIde'

export function registerCloseCommand(cli: CAC) {
  cli
    .command('close', 'close Wechat DevTools')
    .action(async () => {
      await closeIde()
    })
}
