import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'

export function workers({ configService, scanService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:workers',
      enforce: 'pre',
      async options(options) {
        if (scanService.workersDir) {
          const files = await new Fdir().withFullPaths().glob('**/*.{js,ts}').crawl(
            path.resolve(configService.absoluteSrcRoot, scanService.workersDir),
          ).withPromise()
          const input = files.reduce<Record<string, string>>((acc, file) => {
            acc[
              removeExtensionDeep(configService.relativeAbsoluteSrcRoot(file))] = file
            return acc
          }, {})
          options.input = input
        }
      },
      // generateBundle(_x, bundle) {
      //   const keys = Object.keys(bundle)
      //   console.log(keys)
      // },
      outputOptions(options) {
        options.chunkFileNames = () => {
          return path.join(scanService.workersDir ?? '', '[name]-[hash].js')
        }
      },
    },
  ]
}
