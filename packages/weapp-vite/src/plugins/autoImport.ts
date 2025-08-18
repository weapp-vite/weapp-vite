import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '@/context'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
// import { templateExtensions } from '@/constants'
import { defaultExcluded } from '../defaults'
import { isTemplateRequest } from '../utils'

export function autoImport({ configService, autoImportService }: CompilerContext): Plugin[] {
  // let init: Promise<string[]>
  let resolvedConfig: ResolvedConfig
  return [
    {
      name: 'weapp-vite:auto-import',
      enforce: 'pre',
      configResolved(config) {
        resolvedConfig = config
      },
      async buildStart() {
        autoImportService.potentialComponentMap.clear()
        const globs = configService.weappViteConfig?.enhance?.autoImportComponents?.globs
        if (globs) {
          const ignore: string[] = [
            ...defaultExcluded,
            `${resolvedConfig.build.outDir}/**`,
          ]
          const fdir = new Fdir(
            {
              includeDirs: false,
              filters: [
                (path: string) => {
                  return isTemplateRequest(path)
                },
              ],
              pathSeparator: '/',
            },
          )

          const files = await fdir
            .withFullPaths()
            .globWithOptions(globs.map((x) => {
              return path.resolve(configService.absoluteSrcRoot, x)
            }), {
              ignore,
            })
            .crawl(configService.absoluteSrcRoot)
            .withPromise()
          await Promise.all(
            files.map((x) => {
              return autoImportService.scanPotentialComponentEntries(x)
            }),
          )
        }
      },

    },
  ]
}
