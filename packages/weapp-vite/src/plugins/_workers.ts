import type { CompilerContext } from '@/context'
import type { ChangeEvent } from 'rollup'
import type { Plugin } from 'vite'
import logger from '@/logger'
// import { removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'

const internalWorkerInput = '__weapp-vite-workers.js'

// const input = files.reduce<Record<string, string>>((acc, file) => {
//   acc[
//     removeExtensionDeep(configService.relativeAbsoluteSrcRoot(file))] = file
//   return acc
// }, {})
export function workers({ configService, scanService }: CompilerContext): Plugin[] {
  const virtualModuleId = 'virtual:weapp-vite-workers'
  const resolvedVirtualModuleId = `\0${virtualModuleId}`

  const plugins: Plugin[] = []
  if (scanService.workersDir) {
    plugins.push({
      name: 'weapp-vite:workers',
      enforce: 'pre',
      options(options) {
        options.input = path.resolve(configService.packageInfo.rootPath, `modules/${internalWorkerInput}`)//  input
      },
      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId
        }
      },
      async load(id) {
        if (id === resolvedVirtualModuleId) {
          const files = await new Fdir().withFullPaths().glob('**/*.{js,ts}').crawl(
            path.resolve(configService.absoluteSrcRoot, scanService.workersDir!),
          ).withPromise()

          return files.map((x) => {
            return `import('${path.posix.normalize(x)}')`
          }).join('\n')
        }
      },
      watchChange(id: string, change: { event: ChangeEvent }) {
        logger.success(`[workers:${change.event}] ${configService.relativeCwd(id)}`)
      },
      // generateBundle(_x, bundle) {
      //   const keys = Object.keys(bundle)
      //   console.log(keys)
      // },
      outputOptions(options) {
        options.chunkFileNames = (chunkInfo) => {
          return path.join(scanService.workersDir ?? '', chunkInfo.isDynamicEntry ? '[name].js' : '[name]-[hash].js')
        }
      },
      generateBundle(_x, bundle) {
        if (internalWorkerInput in bundle) {
          delete bundle[internalWorkerInput]
        }
      },
    })
  }
  return plugins
}
