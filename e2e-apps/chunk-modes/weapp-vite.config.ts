import process from 'node:process'
import { defineConfig } from 'weapp-vite'

type SharedStrategy = 'duplicate' | 'hoist'
type SharedMode = 'common' | 'path' | 'inline'
type DynamicImports = 'preserve' | 'inline'
type OverrideName = 'none' | 'path' | 'inline' | 'mixed'
type SharedPathRootPreset = 'src' | 'shared' | 'invalid'
type ForceDuplicatePreset = 'none' | 'action'

const overridesByName: Record<OverrideName, { test: string | RegExp, mode: SharedMode }[]> = {
  none: [],
  path: [{ test: 'shared/path-only.ts', mode: 'path' }],
  inline: [{ test: /shared\/inline-only\.ts$/, mode: 'inline' }],
  mixed: [
    { test: 'shared/path-only.ts', mode: 'path' },
    { test: /shared\/inline-only\.ts$/, mode: 'inline' },
  ],
}

const sharedStrategy = (process.env.WEAPP_CHUNK_STRATEGY as SharedStrategy | undefined) ?? 'duplicate'
const sharedMode = (process.env.WEAPP_CHUNK_MODE as SharedMode | undefined) ?? 'common'
const dynamicImports = (process.env.WEAPP_CHUNK_DYNAMIC as DynamicImports | undefined) ?? 'preserve'
const overrideName = (process.env.WEAPP_CHUNK_OVERRIDE as OverrideName | undefined) ?? 'none'
const sharedPathRootPreset = (process.env.WEAPP_CHUNK_SHARED_PATH_ROOT as SharedPathRootPreset | undefined) ?? 'src'
const forceDuplicatePreset = (process.env.WEAPP_CHUNK_FORCE_DUPLICATE as ForceDuplicatePreset | undefined) ?? 'none'
const logOptimization = process.env.WEAPP_CHUNK_LOG_OPTIMIZATION === 'false'
  ? false
  : process.env.WEAPP_CHUNK_LOG_OPTIMIZATION === 'true'
    ? true
    : undefined
const duplicateWarningBytes = process.env.WEAPP_CHUNK_DUPLICATE_WARNING_BYTES
  ? Number(process.env.WEAPP_CHUNK_DUPLICATE_WARNING_BYTES)
  : undefined
const outDir = process.env.WEAPP_CHUNK_OUTDIR ?? 'dist'
const scenarioId = process.env.WEAPP_CHUNK_SCENARIO ?? 'default'

const sharedPathRootByPreset: Record<SharedPathRootPreset, string> = {
  src: 'src',
  shared: 'src/shared',
  invalid: '../outside-src',
}

const forceDuplicatePatternsByPreset: Record<ForceDuplicatePreset, (string | RegExp)[]> = {
  none: [],
  action: ['action/**'],
}

export default defineConfig({
  define: {
    __WEAPP_CHUNK_SCENARIO__: JSON.stringify(scenarioId),
  },
  weapp: {
    srcRoot: 'src',
    chunks: {
      sharedStrategy,
      sharedMode,
      sharedOverrides: overridesByName[overrideName] ?? [],
      sharedPathRoot: sharedPathRootByPreset[sharedPathRootPreset],
      dynamicImports,
      forceDuplicatePatterns: forceDuplicatePatternsByPreset[forceDuplicatePreset] ?? [],
      ...(typeof logOptimization === 'boolean' ? { logOptimization } : {}),
      ...(typeof duplicateWarningBytes === 'number' && Number.isFinite(duplicateWarningBytes)
        ? { duplicateWarningBytes }
        : {}),
    },
    worker: {
      entry: ['index'],
    },
    npm: {
      enable: false,
    },
  },
  build: {
    outDir,
    minify: false,
  },
})
