/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import { fdir } from 'fdir'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  chunkExtraCases,
  chunkMatrixCases,
  expectedFilesForModule,
  importerFiles,
  markers,
  moduleMeta,
  overrideSets,
  resolveSharedMode,
  shouldHaveCommon,
  shouldHaveSubpackageShared,
} from '../chunk-modes.matrix'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist-matrix')

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

function collectRelativeRequires(source: string) {
  const matches = source.matchAll(/require\((['"`])(\.[^'"`]+?\.js)\1\)/g)
  return Array.from(matches, match => match[2])
}

async function runBuildCapture(outDir: string, env: Record<string, string>) {
  const result = await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(APP_ROOT, 'weapp-vite.config.ts'),
  ], {
    env: {
      ...process.env,
      ...env,
      WEAPP_CHUNK_OUTDIR: outDir,
    },
    reject: false,
    all: true,
  })

  if ((result.exitCode ?? 1) !== 0) {
    throw new Error(`chunk-modes build failed for ${outDir}\n${result.all ?? ''}`)
  }

  return result.all ?? ''
}

describe.sequential('e2e chunk modes matrix', () => {
  it('builds all combinations and validates chunk outputs', async () => {
    await fs.remove(DIST_ROOT)

    for (const matrixCase of chunkMatrixCases) {
      for (const overrideSet of overrideSets.filter(item => item.name === matrixCase.overrideName)) {
        const id = matrixCase.id
        const outDir = path.join('dist-matrix', id)
        const outDirAbs = path.join(APP_ROOT, outDir)

        await fs.remove(outDirAbs)

        await runBuild(outDir, matrixCase.env)

        const mp = await collectMarkerLocations(outDirAbs)
        const worker = await collectMarkerLocations(outDirAbs, file => file.startsWith('workers/'))

        const label = `[${id}]`

        for (const entry of Object.values(moduleMeta)) {
          const resolvedMode = resolveSharedMode(matrixCase.mode, overrideSet.overrides, `${entry.rel}.ts`)
          const expected = expectedFilesForModule(entry, resolvedMode, matrixCase.strategy)
          assertLocations(entry.marker, mp.locations[entry.marker], expected, `${label} mp ${entry.rel}`)
        }

        const hasCommon = shouldHaveCommon(matrixCase.mode, overrideSet.overrides, matrixCase.strategy)
        if (hasCommon) {
          expect(mp.files).toContain('common.js')
        }
        else {
          expect(mp.files).not.toContain('common.js')
        }

        const hasSubpackageShared = shouldHaveSubpackageShared(matrixCase.mode, overrideSet.overrides, matrixCase.strategy)
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
        assertDynamicMarker(markers.async, asyncLocations, importerFiles.main, matrixCase.dynamic, `${label} mp async`)

        const workerAsyncLocations = worker.locations[markers.workerAsync]
        assertDynamicMarker(
          markers.workerAsync,
          workerAsyncLocations,
          'workers/index.js',
          matrixCase.dynamic,
          `${label} worker async`,
        )

        const jsFiles = mp.files.filter(file => file.endsWith('.js'))
        const outputFileSet = new Set(mp.files)
        for (const jsFile of jsFiles) {
          const source = await fs.readFile(path.join(outDirAbs, jsFile), 'utf8')
          const relativeRequires = collectRelativeRequires(source)
          for (const specifier of relativeRequires) {
            const resolvedPath = path.normalize(path.join(path.dirname(jsFile), specifier)).replaceAll('\\', '/')
            expect(outputFileSet.has(resolvedPath), `${label} ${jsFile} should resolve ${specifier} to an emitted file`).toBe(true)
          }
        }
      }
    }

    await fs.remove(DIST_ROOT)
  }, 10 * 60_000)

  it('covers sharedPathRoot presets and optimization logging flags', async () => {
    const sharedRootOutDir = path.join('dist-matrix', chunkExtraCases[0].id)
    const sharedRootOutDirAbs = path.join(APP_ROOT, sharedRootOutDir)
    await fs.remove(sharedRootOutDirAbs)
    await runBuild(sharedRootOutDir, chunkExtraCases[0].env)

    const sharedRootFiles = await scanFiles(sharedRootOutDirAbs)
    expect(sharedRootFiles).toContain('common.js')
    expect(sharedRootFiles).toContain('sub-only.js')
    expect(sharedRootFiles).toContain('path-only.js')
    expect(sharedRootFiles).toContain('inline-only.js')
    expect(sharedRootFiles).toContain('vendor.js')
    expect(sharedRootFiles).not.toContain('shared/common.js')
    expect(sharedRootFiles).not.toContain('shared/sub-only.js')

    const invalidRootOutDir = path.join('dist-matrix', chunkExtraCases[1].id)
    const invalidRootOutDirAbs = path.join(APP_ROOT, invalidRootOutDir)
    await fs.remove(invalidRootOutDirAbs)
    const invalidRootOutput = await runBuildCapture(invalidRootOutDir, chunkExtraCases[1].env)

    const invalidRootFiles = await scanFiles(invalidRootOutDirAbs)
    expect(invalidRootOutput).toContain('sharedPathRoot')
    expect(invalidRootOutput).toContain('已回退到 srcRoot')
    expect(invalidRootFiles).toContain('shared/common.js')
    expect(invalidRootFiles).toContain('shared/sub-only.js')
    expect(invalidRootFiles).toContain('shared/path-only.js')
    expect(invalidRootFiles).toContain('shared/vendor.js')

    const warnEnabledOutput = await runBuildCapture(path.join('dist-matrix', chunkExtraCases[2].id), chunkExtraCases[2].env)
    expect(warnEnabledOutput).toContain('超过阈值')

    const warnDisabledOutput = await runBuildCapture(path.join('dist-matrix', chunkExtraCases[3].id), chunkExtraCases[3].env)
    expect(warnDisabledOutput).toContain('超过阈值')
    expect(warnDisabledOutput).not.toContain('共享模块已复制到各自 weapp-shared/common.js')

    const zeroThresholdOutput = await runBuildCapture(path.join('dist-matrix', chunkExtraCases[4].id), chunkExtraCases[4].env)
    expect(zeroThresholdOutput).not.toContain('超过阈值')
  }, 5 * 60_000)
})
