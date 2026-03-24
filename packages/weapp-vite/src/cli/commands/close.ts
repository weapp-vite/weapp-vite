import type { CAC } from 'cac'
import { closeIde } from '../openIde'

export function registerCloseCommand(cli: CAC) {
  cli
    .command('close', 'close Wechat DevTools')
    .action(async () => {
      const closed = await closeIde()
      if (!closed) {
        throw new Error('关闭微信开发者工具失败。')
      }
    })
}
