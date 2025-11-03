import type { InlineConfig } from 'vite'
import type { ConfigService } from './config/types'
import type { ScanService } from './scanPlugin'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { DEFAULT_SHARED_CHUNK_STRATEGY } from './chunkStrategy'

const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi
const REG_COMMONJS_HELPERS = /commonjsHelpers\.js$/

export function createSharedBuildConfig(
  configService: ConfigService,
  scanService: ScanService,
): Partial<InlineConfig> {
  const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
  const commonjsHelpersDeps: RegExp[] = [REG_COMMONJS_HELPERS]
  const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY

  const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
    vendorsMatchers: [nodeModulesDeps, commonjsHelpersDeps],
    relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
    getSubPackageRoots: () => scanService.subPackageMap.keys(),
    strategy: sharedStrategy,
  })

  return {
    build: {
      rolldownOptions: {
        output: {
          advancedChunks: {
            groups: [
              {
                name: (id, ctx) => resolveAdvancedChunkName(id, ctx),
              },
            ],
          },
          chunkFileNames: '[name].js',
        },
      },
    },
  }
}
