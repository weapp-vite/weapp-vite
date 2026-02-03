import { execa } from 'execa'
import { fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/lib-mode')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist-matrix')

const SHARED_MARKER = '__LIB_SHARED_MARKER__'

type SharedStrategy = 'duplicate' | 'hoist'
type SharedMode = 'common' | 'path' | 'inline'

const sharedModes: SharedMode[] = ['common', 'path', 'inline']
const sharedStrategies: SharedStrategy[] = ['duplicate', 'hoist']

async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir({
    relativePaths: true,
    pathSeparator: '/',
  })
  const files = (await fd.crawl(root).withPromise()).sort()
  return files
}

async function findMarkerLocations(root: string) {
  const files = await scanFiles(root)
  const jsFiles = files.filter(file => file.endsWith('.js'))
  const locations: string[] = []
  await Promise.all(
    jsFiles.map(async (file) => {
      const content = await fs.readFile(path.resolve(root, file), 'utf8')
      if (content.includes(SHARED_MARKER)) {
        locations.push(file)
      }
    }),
  )
  return { files, locations }
}

async function runBuild(outDir: string, env: Record<string, string | undefined>) {
  await execa('node', [
    CLI_PATH,
    'build',
    '--config',
    'weapp-vite.config.ts',
    '--mode',
    'production',
  ], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      WEAPP_LIB_OUTDIR: outDir,
      ...env,
    },
  })
}

describe('lib mode e2e', () => {
  it('emits component + pure js entries', async () => {
    const outDir = path.resolve(APP_ROOT, 'dist-lib')
    await fs.remove(outDir)
    await runBuild(outDir, {})

    const files = await scanFiles(outDir)
    const componentCases = [
      { base: 'components/button/index', hasTemplate: true, hasStyle: true },
      { base: 'components/sfc-script/index', hasTemplate: true, hasStyle: false },
      { base: 'components/sfc-setup/index', hasTemplate: false, hasStyle: true },
      { base: 'components/sfc-both/index', hasTemplate: true, hasStyle: true },
    ]

    for (const entry of componentCases) {
      expect(files).toContain(`${entry.base}.js`)
      expect(files).toContain(`${entry.base}.json`)
      if (entry.hasTemplate) {
        expect(files).toContain(`${entry.base}.wxml`)
      }
      else {
        expect(files).not.toContain(`${entry.base}.wxml`)
      }
      if (entry.hasStyle) {
        expect(files).toContain(`${entry.base}.wxss`)
      }
      else {
        expect(files).not.toContain(`${entry.base}.wxss`)
      }
      const componentJson = await fs.readJson(path.resolve(outDir, `${entry.base}.json`))
      expect(componentJson.component).toBe(true)
    }
    expect(files).toContain('utils/index.js')
    expect(files).not.toContain('utils/index.json')
    expect(files).not.toContain('app.json')

    const json = await fs.readJson(path.resolve(outDir, 'components/button/index.json'))
    expect(json.component).toBe(true)
  })

  it('applies fileName override to sidecar outputs', async () => {
    const outDir = path.resolve(APP_ROOT, 'dist-lib-file')
    await fs.remove(outDir)
    await runBuild(outDir, {
      WEAPP_LIB_FILE_NAME: 'lib/[name]',
    })

    const files = await scanFiles(outDir)
    const componentCases = [
      { base: 'lib/components/button/index', hasTemplate: true, hasStyle: true },
      { base: 'lib/components/sfc-script/index', hasTemplate: true, hasStyle: false },
      { base: 'lib/components/sfc-setup/index', hasTemplate: false, hasStyle: true },
      { base: 'lib/components/sfc-both/index', hasTemplate: true, hasStyle: true },
    ]

    for (const entry of componentCases) {
      expect(files).toContain(`${entry.base}.js`)
      expect(files).toContain(`${entry.base}.json`)
      if (entry.hasTemplate) {
        expect(files).toContain(`${entry.base}.wxml`)
      }
      else {
        expect(files).not.toContain(`${entry.base}.wxml`)
      }
      if (entry.hasStyle) {
        expect(files).toContain(`${entry.base}.wxss`)
      }
      else {
        expect(files).not.toContain(`${entry.base}.wxss`)
      }
    }

    expect(files).toContain('lib/utils/index.js')
    expect(files).not.toContain('components/button/index.wxml')
  })

  it('covers shared chunk modes matrix', async () => {
    await fs.remove(DIST_ROOT)
    for (const sharedStrategy of sharedStrategies) {
      for (const sharedMode of sharedModes) {
        const label = `${sharedStrategy}-${sharedMode}`
        const outDir = path.resolve(DIST_ROOT, label)
        await runBuild(outDir, {
          WEAPP_CHUNK_STRATEGY: sharedStrategy,
          WEAPP_CHUNK_MODE: sharedMode,
        })

        const { files, locations } = await findMarkerLocations(outDir)

        expect(files).toContain('components/button/index.js')
        expect(files).toContain('utils/index.js')

        if (sharedMode === 'inline') {
          const hasCommon = locations.includes('common.js') || locations.includes('shared/common.js')
          if (hasCommon) {
            expect(locations).toContain('common.js')
          }
          else {
            expect(locations).toContain('components/button/index.js')
            expect(locations).toContain('utils/index.js')
          }
        }
        else if (sharedMode === 'path') {
          expect(locations).toContain('shared/common.js')
        }
        else {
          expect(locations).toContain('common.js')
        }
      }
    }
  })
})
