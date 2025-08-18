import type { Buffer } from 'node:buffer'
// import type { PathsOutput } from 'fdir'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { CopyGlobs } from '../types'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { defaultAssetExtensions, defaultExcluded } from '../defaults'

export function asset({ configService }: CompilerContext): Plugin[] {
  function resolveGlobs(globs?: CopyGlobs): string[] {
    if (Array.isArray(globs)) {
      return globs
    }

    return []
  }

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
        const weappViteConfig = configService.weappViteConfig
        const include = resolveGlobs(weappViteConfig?.copy?.include)
        const exclude = resolveGlobs(weappViteConfig?.copy?.exclude)
        const filter = weappViteConfig?.copy?.filter ?? (() => true)
        const ignore: string[] = [
          ...defaultExcluded,
          path.resolve(configService.cwd, `${resolvedConfig.build.outDir}/**/*`),
          ...exclude,
        ]
        //
        const fdir = new Fdir({
          includeDirs: false,
          pathSeparator: '/',
        })

        const patterns = [
          `**/*.{${defaultAssetExtensions.join(',')}}`,
          ...include,
        ]
        init = fdir
          .withFullPaths()
          .globWithOptions(patterns, {
            ignore,
            dot: false,
          })
          .crawl(
            configService.absoluteSrcRoot,
          )
          .withPromise()
          .then((files) => {
            return Promise.all(
              files.filter(filter).map(async (file) => {
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
