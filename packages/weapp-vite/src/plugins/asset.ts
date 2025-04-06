import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'
import { fdir as Fdir } from 'fdir'

export function asset({ configService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:asset',
      enforce: 'pre',
      // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
      buildStart() {
        const fdir = new Fdir()
        // 'json',
        const extensions = ['wxs', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'cer', 'mp3', 'aac', 'm4a', 'mp4', 'wav', 'ogg', 'silk', 'wasm', 'br', 'cert']
        const patterns = `**/*.{${extensions.join(',')}}`
        fdir.withFullPaths().glob(patterns).crawl(configService.absoluteSrcRoot).withPromise()
      },
    },
  ]
}
