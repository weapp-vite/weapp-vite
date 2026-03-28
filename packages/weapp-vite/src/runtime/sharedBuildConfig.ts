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

function createStringOrRegExpMatcher(pattern: string | RegExp) {
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
}

function createDualIdMatcher(matchers: Array<(value: string) => boolean>) {
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

function createForceDuplicateTester(patterns?: (string | RegExp)[]) {
  if (!patterns || patterns.length === 0) {
    return undefined
  }

  const matchers = patterns
    .map(pattern => createStringOrRegExpMatcher(pattern))
    .filter((matcher): matcher is (value: string) => boolean => typeof matcher === 'function')

  return createDualIdMatcher(matchers)
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
      const matches = createStringOrRegExpMatcher(test)
      if (matches) {
        return { mode, matches }
      }

      return undefined
    })
    .filter((entry): entry is { mode: SharedChunkMode, matches: (value: string) => boolean } => !!entry)

  if (!matchers.length) {
    return undefined
  }

  return (relativeId: string, absoluteId: string) => {
    const matchedEntry = matchers.find(({ matches }) => matches(relativeId) || matches(absoluteId))
    return matchedEntry?.mode ?? sharedMode
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

  return { resolveAdvancedChunkName }
}

export function createSharedBuildOutput(
  configService: ConfigService,
  getSubPackageRoots: () => Iterable<string>,
) {
  const { resolveAdvancedChunkName } = createSharedBuildResolver(
    configService,
    getSubPackageRoots,
  )

  const output = {
    codeSplitting: {
      groups: [
        {
          name: (
            id: string,
            ctx: Parameters<typeof resolveAdvancedChunkName>[1],
          ) => resolveAdvancedChunkName(id, ctx),
        },
      ],
    },
    chunkFileNames: '[name].js',
  }

  // `codeSplitting` is always enabled for shared chunk naming. Rolldown ignores
  // `inlineDynamicImports` with `codeSplitting` and prints a warning, so skip it.
  return output
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
