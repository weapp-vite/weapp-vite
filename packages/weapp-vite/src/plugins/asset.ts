import type { CompilerContext } from '@/context'
import type { Buffer } from 'node:buffer'
// import type { PathsOutput } from 'fdir'
import type { Plugin, ResolvedConfig } from 'vite'
import { defaultExcluded } from '@/defaults'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'

const defaultExtensions = ['wxs', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'cer', 'mp3', 'aac', 'm4a', 'mp4', 'wav', 'ogg', 'silk', 'wasm', 'br', 'cert']

export function asset({ configService }: CompilerContext): Plugin[] {
  // let output = false

  let init: Promise<{ file: string, buffer: Buffer }[]>
  let resolvedConfig: ResolvedConfig
  return [
    {
      name: 'weapp-vite:asset',
      enforce: 'pre',
      configResolved(config) {
        resolvedConfig = config
      },
      // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
      buildStart() {
        const ignore: string[] = [
          ...defaultExcluded,
          `${resolvedConfig.build.outDir}/**`,
        ]
        const fdir = new Fdir({
          includeDirs: false,
        })

        const patterns = [`**/*.{${defaultExtensions.join(',')}}`]
        init = fdir.withFullPaths().globWithOptions(patterns, {
          ignore,
        }).crawl(configService.absoluteSrcRoot).withPromise().then((files) => {
          return Promise.all(
            files.map(async (file) => {
              return {
                file,
                buffer: await fs.readFile(file),
              }
            }),
          )
        })
      },
      async buildEnd() {
        const res = await init
        for (const item of res) {
          this.emitFile(
            {
              type: 'asset',
              fileName: configService.relativeAbsoluteSrcRoot(item.file),
              source: item.buffer,
            },
          )
        }
      },
      // generateBundle(_, bundle) {
      //   const keys = Object.keys(bundle)
      //   console.log(keys)
      // },
    },
  ]
}
