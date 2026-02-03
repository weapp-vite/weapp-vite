import type { InlineConfig } from 'vite'
import type { SharedChunkMode, SharedChunkOverride } from '../types'
import type { ConfigService } from './config/types'
import type { ScanService } from './scanPlugin'
import path from 'pathe'
import picomatch from 'picomatch'
import { logger } from '../context/shared'
import { isPathInside, normalizeRelativePath } from '../utils/path'
import { isRegexp } from '../utils/regexp'
import { normalizeViteId } from '../utils/viteId'
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

function createSharedModeResolver(
  sharedMode: SharedChunkMode,
  overrides?: SharedChunkOverride[],
) {
  if (!overrides || overrides.length === 0) {
    return undefined
  }

  const matchers = overrides
    .map((override) => {
      const { test, mode } = override
      if (typeof test === 'string') {
        const matcher = picomatch(test, { dot: true })
        return { mode, matches: (value: string) => matcher(value) }
      }

      if (isRegexp(test)) {
        return {
          mode,
          matches: (value: string) => {
            test.lastIndex = 0
            return test.test(value)
          },
        }
      }

      return undefined
    })
    .filter((entry): entry is { mode: SharedChunkMode, matches: (value: string) => boolean } => !!entry)

  if (!matchers.length) {
    return undefined
  }

  return (relativeId: string, absoluteId: string) => {
    for (const { mode, matches } of matchers) {
      if (matches(relativeId) || matches(absoluteId)) {
        return mode
      }
    }
    return sharedMode
  }
}

function createSharedPathResolver(
  configService: ConfigService,
  sharedPathRoot?: string,
) {
  const absoluteSrcRoot = configService.absoluteSrcRoot
  const configuredRoot = sharedPathRoot
    ? path.resolve(configService.cwd, sharedPathRoot)
    : absoluteSrcRoot
  const resolvedRoot = isPathInside(absoluteSrcRoot, configuredRoot)
    ? configuredRoot
    : absoluteSrcRoot

  if (configuredRoot !== resolvedRoot) {
    logger.warn(
      `[chunks] sharedPathRoot "${sharedPathRoot}" 不在 srcRoot 内，已回退到 srcRoot。`,
    )
  }

  return (absoluteId: string) => {
    const cleaned = normalizeViteId(absoluteId, {
      stripQuery: true,
      fileProtocolToPath: true,
      stripAtFsPrefix: true,
      stripLeadingNullByte: true,
    })
    if (!path.isAbsolute(cleaned)) {
      return undefined
    }
    if (!isPathInside(resolvedRoot, cleaned)) {
      return undefined
    }
    return normalizeRelativePath(path.relative(resolvedRoot, cleaned))
  }
}

function createSharedBuildResolver(
  configService: ConfigService,
  getSubPackageRoots: () => Iterable<string>,
) {
  const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
  const commonjsHelpersDeps: RegExp[] = [REG_COMMONJS_HELPERS]
  const chunksConfig = configService.weappViteConfig?.chunks
  const sharedStrategy = chunksConfig?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
  const forceDuplicatePatterns = chunksConfig?.forceDuplicatePatterns
  const sharedMode = chunksConfig?.sharedMode ?? 'common'
  const sharedOverrides = chunksConfig?.sharedOverrides
  const sharedPathRoot = chunksConfig?.sharedPathRoot
  const dynamicImports = chunksConfig?.dynamicImports ?? 'preserve'

  const forceDuplicateTester = createForceDuplicateTester(forceDuplicatePatterns)
  const resolveSharedMode = createSharedModeResolver(sharedMode, sharedOverrides)
  const resolveSharedPath = createSharedPathResolver(configService, sharedPathRoot)

  const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
    vendorsMatchers: [nodeModulesDeps, commonjsHelpersDeps],
    relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
    getSubPackageRoots,
    strategy: sharedStrategy,
    forceDuplicateTester,
    sharedMode,
    resolveSharedMode,
    resolveSharedPath,
  })

  const inlineDynamicImports = dynamicImports === 'inline' ? true : undefined

  return {
    resolveAdvancedChunkName,
    inlineDynamicImports,
  }
}

export function createSharedBuildOutput(
  configService: ConfigService,
  getSubPackageRoots: () => Iterable<string>,
) {
  const { resolveAdvancedChunkName, inlineDynamicImports } = createSharedBuildResolver(
    configService,
    getSubPackageRoots,
  )

  return {
    codeSplitting: {
      groups: [
        {
          name: (id, ctx) => resolveAdvancedChunkName(id, ctx),
        },
      ],
    },
    chunkFileNames: '[name].js',
    inlineDynamicImports,
  }
}

export function createSharedBuildConfig(
  configService: ConfigService,
  scanService: ScanService,
): Partial<InlineConfig> {
  const output = createSharedBuildOutput(configService, () => scanService.subPackageMap.keys())
  return {
    build: {
      rolldownOptions: {
        output,
      },
    },
  }
}
