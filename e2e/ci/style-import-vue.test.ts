import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/style-import-vue')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const WXSS_PATH = path.join(DIST_ROOT, 'pages/index/index.wxss')
const PAGE_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const EXPECTED_MARKERS = ['.hello-import', '.scss-imported', '.external-src']

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

async function runBuild(root: string) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

async function waitForFileContains(filePath: string, markers: string[], timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (markers.every(marker => content.includes(marker))) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain expected markers.`)
}

async function waitForFileWithSourceHeartbeat<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        await replaceFileByRename(touchFilePath, touchContent)
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

describe.sequential('vue style @import resolution (e2e)', () => {
  it('build inlines css/scss/src imports into wxss', async () => {
    await fs.remove(DIST_ROOT)
    await runBuild(APP_ROOT)

    const wxss = await fs.readFile(WXSS_PATH, 'utf8')
    for (const marker of EXPECTED_MARKERS) {
      expect(wxss).toContain(marker)
    }
  })

  it('dev build inlines css/scss/src imports into wxss', async () => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const devProcess = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      const wxss = await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, EXPECTED_MARKERS, 1_000),
          PAGE_SOURCE_PATH,
          originalSource,
        ),
        'weapp style import output',
      )
      for (const marker of EXPECTED_MARKERS) {
        expect(wxss).toContain(marker)
      }
    }
    finally {
      await devProcess.stop(2_000)
    }
  })
})
