import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'
import { changeFileExtension } from '@/utils'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'

export function workers({ configService, scanService }: CompilerContext): Plugin[] {
  let init: Promise<void[]>
  return [
    {
      name: 'weapp-vite:workers',
      enforce: 'pre',
      async buildStart() {
        if (scanService.workersDir) {
          const files = await new Fdir().withFullPaths().glob('**/*.{js,ts}').crawl(
            path.resolve(configService.absoluteSrcRoot, scanService.workersDir),
          ).withPromise()

          init = Promise.all(
            files.map(async (file) => {
              const resolveId = await this.resolve(file)
              if (resolveId) {
                const info = await this.load(resolveId)
                this.emitFile({
                  type: 'chunk',
                  id: info.id,
                  fileName: configService.relativeAbsoluteSrcRoot(changeFileExtension(resolveId.id, '.js')),
                })
              }
            }),
          )
        }
      },
      async buildEnd() {
        await init
      },
    },
  ]
}
