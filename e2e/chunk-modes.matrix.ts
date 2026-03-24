import picomatch from 'picomatch'

export type SharedStrategy = 'duplicate' | 'hoist'
export type SharedMode = 'common' | 'path' | 'inline'
export type DynamicImports = 'preserve' | 'inline'
export type SharedPathRootPreset = 'src' | 'shared' | 'invalid'
export type OverrideName = 'none' | 'path' | 'inline' | 'mixed'

export interface Override {
  test: string | RegExp
  mode: SharedMode
}

export interface RuntimeRouteCase {
  route: string
  readyText: string
  expectedTokens: string[]
}

export interface ChunkMatrixCase {
  id: string
  strategy: SharedStrategy
  mode: SharedMode
  dynamic: DynamicImports
  overrideName: OverrideName
  env: Record<string, string>
}

export interface ChunkExtraCase {
  id: string
  env: Record<string, string>
}

export const markers = {
  common: '__COMMON_MARKER__',
  subOnly: '__SUB_ONLY_MARKER__',
  relayOnly: '__RELAY_ONLY_MARKER__',
  pathOnly: '__PATH_ONLY_MARKER__',
  inlineOnly: '__INLINE_ONLY_MARKER__',
  vendor: '__VENDOR_MARKER__',
  async: '__ASYNC_MARKER__',
  workerAsync: '__WORKER_ASYNC_MARKER__',
} as const

export const importerFiles = {
  main: 'pages/index/index.js',
  packageA: 'packageA/pages/foo.js',
  packageB: 'packageB/pages/bar.js',
}

export const moduleMeta = {
  common: {
    rel: 'shared/common',
    marker: markers.common,
    hasMain: true,
  },
  subOnly: {
    rel: 'shared/sub-only',
    marker: markers.subOnly,
    hasMain: false,
  },
  relayOnly: {
    rel: 'shared/relay-only',
    pathRel: 'action/relay',
    marker: markers.relayOnly,
    hasMain: false,
  },
  pathOnly: {
    rel: 'shared/path-only',
    marker: markers.pathOnly,
    hasMain: true,
  },
  inlineOnly: {
    rel: 'shared/inline-only',
    marker: markers.inlineOnly,
    hasMain: true,
  },
  vendor: {
    rel: 'node_modules/fake-pkg/index',
    pathRel: 'shared/vendor',
    marker: markers.vendor,
    hasMain: true,
    isVendor: true,
  },
} as const

export const overrideSets: Array<{ name: OverrideName, overrides: Override[] }> = [
  { name: 'none', overrides: [] },
  { name: 'path', overrides: [{ test: 'shared/path-only.ts', mode: 'path' }] },
  { name: 'inline', overrides: [{ test: /shared\/inline-only\.ts$/, mode: 'inline' }] },
  {
    name: 'mixed',
    overrides: [
      { test: 'shared/path-only.ts', mode: 'path' },
      { test: /shared\/inline-only\.ts$/, mode: 'inline' },
    ],
  },
]

export const sharedModes: SharedMode[] = ['common', 'path', 'inline']
export const sharedStrategies: SharedStrategy[] = ['duplicate', 'hoist']
export const dynamicImports: DynamicImports[] = ['preserve', 'inline']

export const runtimeBaseRoutes: RuntimeRouteCase[] = [
  {
    route: '/pages/index/index',
    readyText: 'shared chunk modes',
    expectedTokens: ['__COMMON_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageA/pages/foo',
    readyText: 'chunk modes packageA',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__RELAY_ONLY_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageB/pages/bar',
    readyText: 'chunk modes packageB',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__RELAY_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
]

export function caseId(
  strategy: SharedStrategy,
  mode: SharedMode,
  overrides: OverrideName,
  dynamic: DynamicImports,
) {
  return `${strategy}-${mode}-${overrides}-${dynamic}`
}

export function resolveSharedMode(defaultMode: SharedMode, overrides: Override[], relativeId: string): SharedMode {
  if (!overrides.length) {
    return defaultMode
  }
  for (const override of overrides) {
    if (typeof override.test === 'string') {
      const matcher = picomatch(override.test, { dot: true })
      if (matcher(relativeId)) {
        return override.mode
      }
    }
    else {
      override.test.lastIndex = 0
      if (override.test.test(relativeId)) {
        return override.mode
      }
    }
  }
  return defaultMode
}

export function expectedFilesForModule(
  module: typeof moduleMeta[keyof typeof moduleMeta],
  mode: SharedMode,
  strategy: SharedStrategy,
): string[] {
  if (mode === 'inline') {
    return []
  }
  if (mode === 'path') {
    return [`${('pathRel' in module ? module.pathRel : module.rel)}.js`]
  }

  if (module.isVendor) {
    return ['common.js']
  }
  if (module.hasMain) {
    return ['common.js']
  }
  return strategy === 'duplicate'
    ? ['packageA/weapp-shared/common.js', 'packageB/weapp-shared/common.js']
    : ['common.js']
}

export function shouldHaveSubpackageShared(
  mode: SharedMode,
  overrides: Override[],
  strategy: SharedStrategy,
) {
  if (strategy !== 'duplicate') {
    return false
  }
  const resolved = resolveSharedMode(mode, overrides, 'shared/sub-only.ts')
  return resolved === 'common'
}

export function shouldHaveCommon(mode: SharedMode, overrides: Override[], strategy: SharedStrategy) {
  const modules = [moduleMeta.common, moduleMeta.subOnly, moduleMeta.relayOnly, moduleMeta.pathOnly, moduleMeta.inlineOnly]
  for (const module of modules) {
    const resolved = resolveSharedMode(mode, overrides, `${module.rel}.ts`)
    if (resolved !== 'common') {
      continue
    }
    if (module.hasMain || strategy === 'hoist') {
      return true
    }
    if (!module.hasMain && strategy === 'duplicate') {
      return false
    }
  }
  return false
}

export const chunkMatrixCases: ChunkMatrixCase[] = sharedStrategies.flatMap(strategy =>
  sharedModes.flatMap(mode =>
    dynamicImports.flatMap(dynamic =>
      overrideSets.map(({ name }) => ({
        id: caseId(strategy, mode, name, dynamic),
        strategy,
        mode,
        dynamic,
        overrideName: name,
        env: {
          WEAPP_CHUNK_STRATEGY: strategy,
          WEAPP_CHUNK_MODE: mode,
          WEAPP_CHUNK_DYNAMIC: dynamic,
          WEAPP_CHUNK_OVERRIDE: name,
        },
      })),
    ),
  ),
)

export const chunkExtraCases: ChunkExtraCase[] = [
  {
    id: 'path-root-shared',
    env: {
      WEAPP_CHUNK_STRATEGY: 'duplicate',
      WEAPP_CHUNK_MODE: 'path',
      WEAPP_CHUNK_SHARED_PATH_ROOT: 'shared',
    },
  },
  {
    id: 'path-root-invalid',
    env: {
      WEAPP_CHUNK_STRATEGY: 'duplicate',
      WEAPP_CHUNK_MODE: 'path',
      WEAPP_CHUNK_SHARED_PATH_ROOT: 'invalid',
    },
  },
  {
    id: 'duplicate-warn-enabled',
    env: {
      WEAPP_CHUNK_STRATEGY: 'duplicate',
      WEAPP_CHUNK_LOG_OPTIMIZATION: 'true',
      WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '1',
    },
  },
  {
    id: 'duplicate-warn-disabled',
    env: {
      WEAPP_CHUNK_STRATEGY: 'duplicate',
      WEAPP_CHUNK_LOG_OPTIMIZATION: 'false',
      WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '1',
    },
  },
  {
    id: 'duplicate-warn-zero-threshold',
    env: {
      WEAPP_CHUNK_STRATEGY: 'duplicate',
      WEAPP_CHUNK_LOG_OPTIMIZATION: 'true',
      WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '0',
    },
  },
]
