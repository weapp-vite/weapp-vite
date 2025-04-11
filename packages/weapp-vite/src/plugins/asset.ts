import type { CompilerContext } from '@/context'
import type { CopyGlobs, SubPackageMetaValue } from '@/types'
import type { Buffer } from 'node:buffer'
// import type { PathsOutput } from 'fdir'
import type { Plugin, ResolvedConfig } from 'vite'
import { defaultAssetExtensions, defaultExcluded } from '@/defaults'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'

export function asset({ configService }: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  function resolveGlobs(globs?: CopyGlobs): string[] {
    if (Array.isArray(globs)) {
      return globs
    }

    if (typeof globs === 'function') {
      return globs(subPackageMeta)
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
        const include = resolveGlobs(configService.weappViteConfig?.copy?.include)
        const exclude = resolveGlobs(configService.weappViteConfig?.copy?.exclude)
        const ignore: string[] = [
          ...defaultExcluded,
          `${resolvedConfig.build.outDir}/**`,
          ...exclude,
        ]
        //
        const fdir = new Fdir({
          includeDirs: false,
        })

        const patterns = [
          `**/*.{${defaultAssetExtensions.join(',')}}`,
          ...include,
        ]
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
