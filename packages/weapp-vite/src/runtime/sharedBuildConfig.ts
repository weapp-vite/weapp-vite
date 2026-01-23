import type { InlineConfig } from 'vite'
import type { ConfigService } from './config/types'
import type { ScanService } from './scanPlugin'
import picomatch from 'picomatch'
import { isRegexp } from '../utils/regexp'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { DEFAULT_SHARED_CHUNK_STRATEGY } from './chunkStrategy'

const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi
const REG_COMMONJS_HELPERS = /commonjsHelpers\.js$/

function createForceDuplicateTester(patterns?: (string | RegExp)[]) {
  if (!patterns || patterns.length === 0) {
    return undefined
  }

  const matchers = patterns
    .map((pattern) => {
      if (typeof pattern === 'string') {
        const matcher = picomatch(pattern, { dot: true })
        return (value: string) => matcher(value)
      }

      if (isRegexp(pattern)) {
        return (value: string) => {
          pattern.lastIndex = 0
          return pattern.test(value)
        }
      }

      return undefined
    })
    .filter((matcher): matcher is (value: string) => boolean => typeof matcher === 'function')

  if (!matchers.length) {
    return undefined
  }

  return (relativeId: string, absoluteId: string) => {
    for (const matcher of matchers) {
      if (matcher(relativeId) || matcher(absoluteId)) {
        return true
      }
    }
    return false
  }
}

export function createSharedBuildConfig(
  configService: ConfigService,
  scanService: ScanService,
): Partial<InlineConfig> {
  const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
  const commonjsHelpersDeps: RegExp[] = [REG_COMMONJS_HELPERS]
  const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
  const forceDuplicatePatterns = configService.weappViteConfig?.chunks?.forceDuplicatePatterns

  const forceDuplicateTester = createForceDuplicateTester(forceDuplicatePatterns)

  const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
    vendorsMatchers: [nodeModulesDeps, commonjsHelpersDeps],
    relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
    getSubPackageRoots: () => scanService.subPackageMap.keys(),
    strategy: sharedStrategy,
    forceDuplicateTester,
  })

  return {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: (id, ctx) => resolveAdvancedChunkName(id, ctx),
              },
            ],
          },
          inlineDynamicImports: false,
          chunkFileNames: '[name].js',
        },
      },
    },
  }
}
