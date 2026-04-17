/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import { fdir } from 'fdir'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

type SharedStrategy = 'duplicate' | 'hoist'

interface FixtureCase {
  id: string
  appRoot: string
  subOnlyMarker: string
  npmSubOnlyMarker: string
  singleNpmMarker: string
  singleNpmRoot: string
  subOnlyRoots: string[]
  duplicateSubOnlyKind: 'subpackage-shared' | 'flattened-shared'
  pairMarker: string
  pairRoots: string[]
  pairBehavior: 'subpackage-shared-vs-hoist' | 'runtime-chain'
  expectFallbackUnderscoreInDuplicate: boolean
}

const fixtureCases: FixtureCase[] = [
  {
    id: 'complex-a',
    appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-a'),
    subOnlyMarker: '__SP_COMPLEX_A_SUB_ONLY__',
    npmSubOnlyMarker: '__SP_COMPLEX_A_NPM_SUB_ONLY__',
    singleNpmMarker: '__SP_COMPLEX_A_NPM_SINGLE__',
    singleNpmRoot: 'item',
    subOnlyRoots: ['item', 'user', 'report'],
    duplicateSubOnlyKind: 'subpackage-shared',
    pairMarker: '__SP_COMPLEX_A_PAIR_ONLY__',
    pairRoots: ['item', 'user'],
    pairBehavior: 'subpackage-shared-vs-hoist',
    expectFallbackUnderscoreInDuplicate: false,
  },
  {
    id: 'complex-b',
    appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-b'),
    subOnlyMarker: '__SP_COMPLEX_B_CLUSTER__',
    npmSubOnlyMarker: '__SP_COMPLEX_B_NPM_SUB_ONLY__',
    singleNpmMarker: '__SP_COMPLEX_B_NPM_SINGLE__',
    singleNpmRoot: 'beta',
    subOnlyRoots: ['alpha', 'beta', 'gamma'],
    duplicateSubOnlyKind: 'flattened-shared',
    pairMarker: '__SP_COMPLEX_B_EDGE__',
    pairRoots: ['alpha', 'gamma'],
    pairBehavior: 'subpackage-shared-vs-hoist',
    expectFallbackUnderscoreInDuplicate: true,
  },
]

const sharedStrategies: SharedStrategy[] = ['duplicate', 'hoist']

function isRootCommonChunk(file: string) {
  return /^common(?:\.\d+)?\.js$/.test(file)
    || file === 'app.js'
    || /^weapp-vendors\/.+\.js$/.test(file)
}

function isSubpackageSharedChunk(file: string, root: string) {
  return file.startsWith(`subpackages/${root}/weapp-shared/common`)
}

function isInSubpackageRoot(file: string, root: string) {
  return file.startsWith(`subpackages/${root}/`)
}

function isFlattenedSubpackagesSharedChunk(file: string) {
  return /subpackages_[^/]*subpackages_[^/]*\/common(?:\.\d+)?\.js$/.test(file)
}

async function runBuild(appRoot: string, outDir: string, strategy: SharedStrategy) {
  await execa('node', [
    CLI_PATH,
    'build',
    appRoot,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(appRoot, 'weapp-vite.config.ts'),
  ], {
    cwd: appRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      WEAPP_CHUNK_STRATEGY: strategy,
      WEAPP_CHUNK_OUTDIR: outDir,
    },
  })
}

async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir({
    relativePaths: true,
    pathSeparator: '/',
  })

  return (await fd.crawl(root).withPromise()).sort()
}

async function collectMarkerLocations(root: string, markers: string[]) {
  const files = await scanFiles(root)
  const jsFiles = files.filter(file => file.endsWith('.js'))
  const locations: Record<string, string[]> = {}
  markers.forEach((marker) => {
    locations[marker] = []
  })

  await Promise.all(
    jsFiles.map(async (file) => {
      const content = await fs.readFile(path.resolve(root, file), 'utf8')
      for (const marker of markers) {
        if (content.includes(marker)) {
          locations[marker].push(file)
        }
      }
    }),
  )

  return { files, locations }
}

describe.sequential('e2e subpackage sharedStrategy complex matrix', () => {
  it('keeps subpackage shared chunk routing stable under duplicate/hoist in complex graphs', async () => {
    for (const fixture of fixtureCases) {
      const distRoot = path.resolve(fixture.appRoot, 'dist-matrix')
      await fs.remove(distRoot)

      for (const strategy of sharedStrategies) {
        const outDir = path.join('dist-matrix', strategy)
        const outDirAbs = path.resolve(fixture.appRoot, outDir)

        await fs.remove(outDirAbs)
        await runBuild(fixture.appRoot, outDir, strategy)

        const markers = [fixture.subOnlyMarker, fixture.npmSubOnlyMarker, fixture.singleNpmMarker, fixture.pairMarker]
        const { files, locations } = await collectMarkerLocations(outDirAbs, markers)

        const subOnlyLocations = locations[fixture.subOnlyMarker]
        const npmSubOnlyLocations = locations[fixture.npmSubOnlyMarker]
        const singleNpmLocations = locations[fixture.singleNpmMarker]
        const pairLocations = locations[fixture.pairMarker]

        expect(singleNpmLocations.length, `[${fixture.id}] single npm marker emitted`).toBeGreaterThan(0)
        expect(singleNpmLocations.some(isRootCommonChunk), `[${fixture.id}] single npm in root common`).toBe(false)
        expect(
          singleNpmLocations.every(file => isInSubpackageRoot(file, fixture.singleNpmRoot)),
          `[${fixture.id}] single npm confined to ${fixture.singleNpmRoot}`,
        ).toBe(true)

        if (strategy === 'duplicate') {
          if (fixture.duplicateSubOnlyKind === 'subpackage-shared') {
            for (const root of fixture.subOnlyRoots) {
              expect(
                subOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] duplicate subOnly ${root}`,
              ).toBe(true)
            }
            expect(subOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] duplicate flattened`).toBe(false)
            for (const root of fixture.subOnlyRoots) {
              expect(
                npmSubOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] duplicate npm subOnly ${root}`,
              ).toBe(true)
            }
            expect(npmSubOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] duplicate npm flattened`).toBe(false)
          }
          else {
            expect(subOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] duplicate flattened`).toBe(true)
            for (const root of fixture.subOnlyRoots) {
              expect(
                subOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] duplicate subOnly ${root}`,
              ).toBe(false)
            }
            expect(npmSubOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] duplicate npm flattened`).toBe(true)
            for (const root of fixture.subOnlyRoots) {
              expect(
                npmSubOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] duplicate npm subOnly ${root}`,
              ).toBe(false)
            }
          }
          expect(subOnlyLocations.some(isRootCommonChunk), `[${fixture.id}] duplicate subOnly`).toBe(false)
          expect(npmSubOnlyLocations.some(isRootCommonChunk), `[${fixture.id}] duplicate npm subOnly`).toBe(false)

          if (fixture.pairBehavior === 'subpackage-shared-vs-hoist') {
            for (const root of fixture.pairRoots) {
              expect(
                pairLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] duplicate pair ${root}`,
              ).toBe(true)
            }
            expect(pairLocations.some(isRootCommonChunk), `[${fixture.id}] duplicate pair`).toBe(false)
          }
          else {
            expect(pairLocations, `[${fixture.id}] duplicate pair runtime-chain`).toContain('runtime-chain.js')
          }

          if (fixture.duplicateSubOnlyKind === 'subpackage-shared') {
            for (const root of fixture.subOnlyRoots) {
              const sharedFile = subOnlyLocations.find(file => isSubpackageSharedChunk(file, root))
              expect(sharedFile, `[${fixture.id}] duplicate shared ${root}`).toBeTruthy()
              const sharedPath = path.resolve(outDirAbs, sharedFile!)
              const sharedContent = await fs.readFile(sharedPath, 'utf8')
              const pagePath = path.resolve(outDirAbs, `subpackages/${root}/index.js`)
              const pageContent = await fs.readFile(pagePath, 'utf8')

              expect(sharedContent).toContain('exports')
              expect(pageContent).toMatch(/require\((['"`])\.\/weapp-shared\/common(?:\.\d+)?\.js\1\)/)
              expect(pageContent).not.toMatch(/require\((['"`]).*subpackages_[^'"`)]*subpackages_[^'"`)]*\/common(?:\.\d+)?\.js\1\)/)
              expect(pageContent).not.toMatch(/require\((['"`])[^\n\r+\u2028\u2029]*\+[^\n\r"')`\u2028\u2029]*(?:["')`][^\n\r+\u2028\u2029]*\+[^\n\r"')`\u2028\u2029]*)*(?:[\n\r\u2028\u2029][^"')`]*)?\/common(?:\.\d+)?\.js\1\)/)
            }
          }
        }
        else {
          expect(subOnlyLocations.some(isRootCommonChunk), `[${fixture.id}] hoist subOnly`).toBe(true)
          expect(npmSubOnlyLocations.some(isRootCommonChunk), `[${fixture.id}] hoist npm subOnly`).toBe(true)
          expect(subOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] hoist flattened`).toBe(false)
          expect(npmSubOnlyLocations.some(isFlattenedSubpackagesSharedChunk), `[${fixture.id}] hoist npm flattened`).toBe(false)
          for (const root of fixture.subOnlyRoots) {
            expect(
              subOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
              `[${fixture.id}] hoist subOnly ${root}`,
            ).toBe(false)
            expect(
              npmSubOnlyLocations.some(file => isSubpackageSharedChunk(file, root)),
              `[${fixture.id}] hoist npm subOnly ${root}`,
            ).toBe(false)
          }

          if (fixture.pairBehavior === 'subpackage-shared-vs-hoist') {
            expect(pairLocations.some(isRootCommonChunk), `[${fixture.id}] hoist pair`).toBe(true)
            for (const root of fixture.pairRoots) {
              expect(
                pairLocations.some(file => isSubpackageSharedChunk(file, root)),
                `[${fixture.id}] hoist pair ${root}`,
              ).toBe(false)
            }
          }
          else {
            expect(pairLocations, `[${fixture.id}] hoist pair runtime-chain`).toContain('runtime-chain.js')
          }
        }

        const hasFallbackUnderscore = files.some(file => /subpackages_[^/]*subpackages_[^/]*\/common\.js$/.test(file))
        const hasFallbackPlus = files.some(file => /subpackages_[^+/]*\+[^/]*\/common\.js$/.test(file))

        const expectedFallbackUnderscore = strategy === 'duplicate'
          ? fixture.expectFallbackUnderscoreInDuplicate
          : false
        expect(hasFallbackUnderscore, `[${fixture.id}] fallback underscore`).toBe(expectedFallbackUnderscore)
        expect(hasFallbackPlus, `[${fixture.id}] fallback plus`).toBe(false)
      }

      await fs.remove(distRoot)
    }
  }, 10 * 60_000)
})
