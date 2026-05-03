import type { InlineConfig } from 'vite'
import type { SharedChunkMode, SharedChunkOverride } from '../types'
import type { AdvancedChunkNameResolver } from './advancedChunks'
import type { ConfigService } from './config/types'
import type { ScanService } from './scanPlugin'
import path from 'pathe'
import picomatch from 'picomatch'
import { logger } from '../context/shared'
import { REQUEST_GLOBAL_RUNTIME_CHUNK_FILE_BASENAME } from '../plugins/core/lifecycle/emit/constants'
import { normalizeNpmImportLookupPath } from '../utils/npmImport'
import { isPathInside, normalizeRelativePath } from '../utils/path'
import { isRegexp } from '../utils/regexp'
import { normalizeViteId } from '../utils/viteId'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { DEFAULT_SHARED_CHUNK_STRATEGY } from './chunkStrategy'

const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi
const REG_COMMONJS_HELPERS = /commonjsHelpers\.js$/
const REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID = /(?:^|[/\\])(?:@wevu[/\\]web-apis|web-apis[/\\]dist[/\\]index\.(?:m?js|cjs)|weapp-vite[/\\](?:dist[/\\]web-apis\.mjs|src[/\\](?:webApis\.ts|runtime[/\\]webApis[/\\]index\.ts)))(?:$|[?#])/
const REG_HASHED_DIST_CHUNK_ID = /(?:^|[/\\])dist[/\\]([^/\\]+)-(\w{6,})\.(?:m?js|cjs)(?:$|[?#])/

function resolveSharedPathRoot(
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

  return {
    configuredRoot,
    resolvedRoot,
  }
}

function normalizeSharedPathCandidate(absoluteId: string) {
  return normalizeViteId(absoluteId, {
    stripQuery: true,
    fileProtocolToPath: true,
    stripAtFsPrefix: true,
    stripLeadingNullByte: true,
  })
}

function resolveNodeModulesSharedPath(cleanedAbsoluteId: string) {
  const normalized = cleanedAbsoluteId.replaceAll('\\', '/')
  const marker = '/node_modules/'
  const markerIndex = normalized.lastIndexOf(marker)
  if (markerIndex < 0) {
    return undefined
  }

  const packageRelativePath = normalizeNpmImportLookupPath(normalized.slice(markerIndex))
  return packageRelativePath ? normalizeRelativePath(packageRelativePath) : undefined
}

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
  const { configuredRoot, resolvedRoot } = resolveSharedPathRoot(configService, sharedPathRoot)

  if (configuredRoot !== resolvedRoot) {
    logger.warn(
      `[chunks] sharedPathRoot "${sharedPathRoot}" 不在 srcRoot 内，已回退到 srcRoot。`,
    )
  }

  return (absoluteId: string) => {
    const cleaned = normalizeSharedPathCandidate(absoluteId)
    if (!path.isAbsolute(cleaned)) {
      return undefined
    }
    if (!isPathInside(resolvedRoot, cleaned)) {
      return resolveNodeModulesSharedPath(cleaned)
    }
    return normalizeRelativePath(path.relative(resolvedRoot, cleaned))
  }
}

function resolveSharedBuildChunksOptions(configService: ConfigService) {
  const chunksConfig = configService.weappViteConfig?.chunks

  return {
    sharedStrategy: chunksConfig?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY,
    forceDuplicatePatterns: chunksConfig?.forceDuplicatePatterns,
    sharedMode: chunksConfig?.sharedMode ?? 'common',
    sharedOverrides: chunksConfig?.sharedOverrides,
    sharedPathRoot: chunksConfig?.sharedPathRoot,
  }
}

function isRequestGlobalsRuntimeChunk(chunk: { name: string, moduleIds?: string[] | readonly string[], facadeModuleId?: string | null }) {
  if (chunk.name !== 'dist') {
    return false
  }

  const candidateIds = [
    chunk.facadeModuleId,
    ...(chunk.moduleIds ?? []),
  ].filter((id): id is string => typeof id === 'string')

  return candidateIds.some((id) => {
    REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.lastIndex = 0
    return REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.test(id)
  })
}

function sanitizePackageToken(value: string) {
  return value
    .replace(/^@/, '')
    .replaceAll(/[\\/]/g, '-')
    .replaceAll(/[^\w-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function resolveDistChunkPackageToken(cleanedAbsoluteId: string) {
  const npmRelativePath = resolveNodeModulesSharedPath(cleanedAbsoluteId)
  if (npmRelativePath) {
    const [packagePath] = npmRelativePath.split('/dist/')
    if (packagePath) {
      return sanitizePackageToken(packagePath)
    }
  }

  const normalized = cleanedAbsoluteId.replaceAll('\\', '/')
  const segments = normalized.split('/')
  const distIndex = segments.lastIndexOf('dist')
  if (distIndex <= 0) {
    return undefined
  }

  const packageToken = segments[distIndex - 1]
  if (!packageToken) {
    return undefined
  }

  return sanitizePackageToken(packageToken)
}

function isRequestGlobalsRuntimeModuleId(id: string) {
  const cleanedAbsoluteId = normalizeSharedPathCandidate(id)
  REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.lastIndex = 0
  if (REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.test(cleanedAbsoluteId)) {
    return true
  }

  return resolveDistChunkPackageToken(cleanedAbsoluteId)?.endsWith('web-apis') === true
}

function resolveStableHashedDistChunkFileName(
  chunk: { moduleIds?: string[] | readonly string[], facadeModuleId?: string | null },
) {
  const candidateIds = [
    chunk.facadeModuleId,
    ...(chunk.moduleIds ?? []),
  ].filter((id): id is string => typeof id === 'string')

  for (const id of candidateIds) {
    const cleanedAbsoluteId = normalizeSharedPathCandidate(id)
    if (!path.isAbsolute(cleanedAbsoluteId)) {
      continue
    }

    const matched = cleanedAbsoluteId.match(REG_HASHED_DIST_CHUNK_ID)
    if (!matched) {
      continue
    }

    const baseName = matched[1]
    const packageToken = resolveDistChunkPackageToken(cleanedAbsoluteId)
    if (!baseName || !packageToken) {
      continue
    }

    REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.lastIndex = 0
    if (REG_REQUEST_GLOBAL_RUNTIME_VENDOR_ID.test(cleanedAbsoluteId) || packageToken.endsWith('web-apis')) {
      return `weapp-vendors/request-globals-${packageToken}-${baseName}.js`
    }

    return `weapp-vendors/${packageToken}-${baseName}.js`
  }

  return undefined
}

function createSharedBuildResolver(
  configService: ConfigService,
  getSubPackageRoots: () => Iterable<string>,
) {
  const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
  const commonjsHelpersDeps: RegExp[] = [REG_COMMONJS_HELPERS]
  const {
    sharedStrategy,
    forceDuplicatePatterns,
    sharedMode,
    sharedOverrides,
    sharedPathRoot,
  } = resolveSharedBuildChunksOptions(configService)
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

  const resolveSharedBuildChunkName: AdvancedChunkNameResolver = (id, ctx) => {
    if (isRequestGlobalsRuntimeModuleId(id)) {
      return REQUEST_GLOBAL_RUNTIME_CHUNK_FILE_BASENAME.replace(/\.js$/, '')
    }
    return resolveAdvancedChunkName(id, ctx)
  }

  return { resolveAdvancedChunkName: resolveSharedBuildChunkName }
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
    minifyInternalExports: false,
    chunkFileNames: (chunk: { name: string, moduleIds?: string[] | readonly string[], facadeModuleId?: string | null }) => {
      if (isRequestGlobalsRuntimeChunk(chunk)) {
        return REQUEST_GLOBAL_RUNTIME_CHUNK_FILE_BASENAME
      }
      const stableHashedDistChunkFileName = resolveStableHashedDistChunkFileName(chunk)
      if (stableHashedDistChunkFileName) {
        return stableHashedDistChunkFileName
      }
      return '[name].js'
    },
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

export {
  createDualIdMatcher,
  createForceDuplicateTester,
  createSharedModeResolver,
  createSharedPathResolver,
  createStringOrRegExpMatcher,
  isRequestGlobalsRuntimeChunk,
  isRequestGlobalsRuntimeModuleId,
  normalizeSharedPathCandidate,
  resolveNodeModulesSharedPath,
  resolveSharedBuildChunksOptions,
  resolveSharedPathRoot,
  resolveStableHashedDistChunkFileName,
}
