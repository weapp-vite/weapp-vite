import { setTimeout as sleep } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-router-hmr')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_JS_PATH = path.join(DIST_ROOT, 'app.js')
const COMMON_JS_PATH = path.join(DIST_ROOT, 'common.js')
const PAGE_VUE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/index/index.js')
const BASE_MARKER = 'ROUTER-HMR-BASE'
const BARE_WEVU_ROUTER_RE = /(?:from\s+['"]wevu\/router['"]|require\(\s*['"]wevu\/router['"]\s*\))/

async function readAllDistJsFiles() {
  const files = await fs.readdir(DIST_ROOT, { recursive: true })
  const chunks: Array<{ filePath: string, content: string }> = []

  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }

    const filePath = path.join(DIST_ROOT, file)
    chunks.push({
      filePath,
      content: await fs.readFile(filePath, 'utf8'),
    })
  }

  return chunks
}

async function assertNoBareWevuRouterImport(label: string) {
  const chunks = await readAllDistJsFiles()
  const offenders = chunks
    .filter(chunk => BARE_WEVU_ROUTER_RE.test(chunk.content))
    .map(chunk => path.relative(DIST_ROOT, chunk.filePath).replaceAll('\\', '/'))

  expect(offenders, `${label} should not leave bare wevu/router imports`).toEqual([])
}

function replaceMarker(source: string, nextMarker: string) {
  const updated = source.replace(BASE_MARKER, nextMarker)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into router page.')
  }
  return updated
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(DIST_ROOT)
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('wevu/router HMR app fixture (dev watch)', () => {
  it('keeps router subpath imports rewritten after a page save refreshes the app entry', async () => {
    const originalPageSource = await fs.readFile(PAGE_VUE_PATH, 'utf8')
    const marker = createHmrMarker('WEVU-ROUTER-APP-ENTRY', 'weapp')
    const updatedPageSource = replaceMarker(originalPageSource, marker)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFileContains(COMMON_JS_PATH, 'weapp-vendors/wevu-router.js'), 'initial common.js imports wevu router vendor')
      await dev.waitFor(waitForFileContains(PAGE_JS_PATH, BASE_MARKER), 'initial router page script emitted')
      await assertNoBareWevuRouterImport('initial build')

      await sleep(1_000)
      await replaceFileByRename(PAGE_VUE_PATH, updatedPageSource)

      await dev.waitFor(waitForFileContains(PAGE_JS_PATH, marker), 'page HMR marker emitted')
      await dev.waitFor(waitForFileContains(COMMON_JS_PATH, 'weapp-vendors/wevu-router.js'), 'common.js keeps router vendor after page HMR')

      const appJs = await fs.readFile(APP_JS_PATH, 'utf8')
      expect(appJs).not.toMatch(BARE_WEVU_ROUTER_RE)
      await assertNoBareWevuRouterImport('page hmr')
      expect(dev.getOutput()).not.toContain('module \'wevu/router.js\' is not defined')
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(PAGE_VUE_PATH, originalPageSource, 'utf8')
    }
  })
})
