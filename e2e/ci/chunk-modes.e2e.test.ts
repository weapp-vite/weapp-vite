import { execa } from 'execa'
import { fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import picomatch from 'picomatch'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist-matrix')

const markers = {
  common: '__COMMON_MARKER__',
  subOnly: '__SUB_ONLY_MARKER__',
  pathOnly: '__PATH_ONLY_MARKER__',
  inlineOnly: '__INLINE_ONLY_MARKER__',
  vendor: '__VENDOR_MARKER__',
  async: '__ASYNC_MARKER__',
  workerAsync: '__WORKER_ASYNC_MARKER__',
} as const

type SharedStrategy = 'duplicate' | 'hoist'
type SharedMode = 'common' | 'path' | 'inline'
type DynamicImports = 'preserve' | 'inline'

type OverrideName = 'none' | 'path' | 'inline' | 'mixed'

interface Override {
  test: string | RegExp
  mode: SharedMode
}

const overrideSets: Array<{ name: OverrideName, overrides: Override[] }> = [
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

const sharedModes: SharedMode[] = ['common', 'path', 'inline']
const sharedStrategies: SharedStrategy[] = ['duplicate', 'hoist']
const dynamicImports: DynamicImports[] = ['preserve', 'inline']

const importerFiles = {
  main: 'pages/index/index.js',
  packageA: 'packageA/pages/foo.js',
  packageB: 'packageB/pages/bar.js',
}

const moduleMeta = {
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

function resolveSharedMode(defaultMode: SharedMode, overrides: Override[], relativeId: string): SharedMode {
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

function expectedFilesForModule(
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

function shouldHaveSubpackageShared(
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

function shouldHaveCommon(mode: SharedMode, overrides: Override[], strategy: SharedStrategy) {
  const modules = [moduleMeta.common, moduleMeta.subOnly, moduleMeta.pathOnly, moduleMeta.inlineOnly]
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

function assertLocations(_marker: string, actual: string[], expected: string[], label: string) {
  if (expected.length === 0) {
    expect(actual.length, `${label} marker locations`).toBeGreaterThan(0)
    return
  }
  expect(new Set(actual), `${label} marker locations`).toEqual(new Set(expected))
}

function assertDynamicMarker(
  _marker: string,
  actual: string[],
  importerFile: string,
  mode: DynamicImports,
  label: string,
) {
  if (mode === 'preserve') {
    expect(actual.includes(importerFile), `${label} should not inline`).toBe(false)
    expect(actual.length, `${label} should emit a chunk`).toBeGreaterThan(0)
  }
  else {
    if (actual.includes(importerFile) && actual.length === 1) {
      return
    }
    expect(actual.length, `${label} should emit a chunk`).toBeGreaterThan(0)
  }
}

async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir({
    relativePaths: true,
    pathSeparator: '/',
  })
  const files = (await fd.crawl(root).withPromise()).sort()
  return files
}

async function collectMarkerLocations(root: string, filter?: (file: string) => boolean) {
  const files = await scanFiles(root)
  const jsFiles = files.filter(file => file.endsWith('.js') && (!filter || filter(file)))
  const locations: Record<string, string[]> = {}
  Object.values(markers).forEach((marker) => {
    locations[marker] = []
  })

  await Promise.all(
    jsFiles.map(async (file) => {
      const content = await fs.readFile(path.resolve(root, file), 'utf8')
      for (const marker of Object.values(markers)) {
        if (content.includes(marker)) {
          locations[marker].push(file)
        }
      }
    }),
  )

  return { files, locations }
}

async function runBuild(outDir: string, env: Record<string, string>) {
  await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(APP_ROOT, 'weapp-vite.config.ts'),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
      WEAPP_CHUNK_OUTDIR: outDir,
    },
  })
}

function caseId(strategy: SharedStrategy, mode: SharedMode, overrides: OverrideName, dynamic: DynamicImports) {
  return `${strategy}-${mode}-${overrides}-${dynamic}`
}

describe.sequential('e2e chunk modes matrix', () => {
  it('builds all combinations and validates chunk outputs', async () => {
    await fs.remove(DIST_ROOT)

    for (const strategy of sharedStrategies) {
      for (const mode of sharedModes) {
        for (const dynamic of dynamicImports) {
          for (const overrideSet of overrideSets) {
            const id = caseId(strategy, mode, overrideSet.name, dynamic)
            const outDir = path.join('dist-matrix', id)
            const outDirAbs = path.join(APP_ROOT, outDir)

            await fs.remove(outDirAbs)

            await runBuild(outDir, {
              WEAPP_CHUNK_STRATEGY: strategy,
              WEAPP_CHUNK_MODE: mode,
              WEAPP_CHUNK_DYNAMIC: dynamic,
              WEAPP_CHUNK_OVERRIDE: overrideSet.name,
            })

            const mp = await collectMarkerLocations(outDirAbs)
            const worker = await collectMarkerLocations(outDirAbs, file => file.startsWith('workers/'))

            const label = `[${id}]`

            for (const entry of Object.values(moduleMeta)) {
              const resolvedMode = resolveSharedMode(mode, overrideSet.overrides, `${entry.rel}.ts`)
              const expected = expectedFilesForModule(entry, resolvedMode, strategy)
              assertLocations(entry.marker, mp.locations[entry.marker], expected, `${label} mp ${entry.rel}`)
            }

            const hasCommon = shouldHaveCommon(mode, overrideSet.overrides, strategy)
            if (hasCommon) {
              expect(mp.files).toContain('common.js')
            }
            else {
              expect(mp.files).not.toContain('common.js')
            }

            const hasSubpackageShared = shouldHaveSubpackageShared(mode, overrideSet.overrides, strategy)
            if (hasSubpackageShared) {
              expect(mp.files).toContain('packageA/weapp-shared/common.js')
              expect(mp.files).toContain('packageB/weapp-shared/common.js')
            }
            else {
              expect(mp.files).not.toContain('packageA/weapp-shared/common.js')
              expect(mp.files).not.toContain('packageB/weapp-shared/common.js')
            }

            expect(mp.files.some(file => file.startsWith('weapp_shared_virtual/'))).toBe(false)

            const asyncLocations = mp.locations[markers.async]
            assertDynamicMarker(markers.async, asyncLocations, importerFiles.main, dynamic, `${label} mp async`)

            const workerAsyncLocations = worker.locations[markers.workerAsync]
            assertDynamicMarker(
              markers.workerAsync,
              workerAsyncLocations,
              'workers/index.js',
              dynamic,
              `${label} worker async`,
            )
          }
        }
      }
    }

    await fs.remove(DIST_ROOT)
  }, 10 * 60_000)
})
