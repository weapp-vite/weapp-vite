import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/github-issues')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const CONFIG_PATH = path.join(
  ROOT,
  'e2e/ci/githubIssuesBuild/cases/issue862.config.ts',
)
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_JSON_PATH = path.join(DIST_ROOT, 'app.json')
const VANT_OUTPUT_PATH = path.join(
  DIST_ROOT,
  'miniprogram_npm/@vant/weapp/field/index.json',
)
const WATCH_PROBE_MARKER = path.join(APP_ROOT, '.tmp/issue-862-output-watched')

async function waitForFile(filePath: string, timeoutMs = 30_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${path.relative(APP_ROOT, filePath)}`)
}

describe.sequential('issue #862 generated output watch', () => {
  beforeEach(async () => {
    await cleanupResidualDevProcesses()
    await fs.remove(DIST_ROOT)
    await fs.remove(WATCH_PROBE_MARKER)
  })

  afterEach(async () => {
    await cleanupResidualDevProcesses()
    await fs.remove(DIST_ROOT)
    await fs.remove(WATCH_PROBE_MARKER)
  })

  it('does not subscribe the internal Vite watcher to Vant files in outDir', async () => {
    const dev = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      APP_ROOT,
      '--platform',
      'weapp',
      '--config',
      CONFIG_PATH,
      '--skipNpm',
    ], {
      all: true,
      cwd: APP_ROOT,
      env: createDevProcessEnv({ usePolling: false }),
      reject: false,
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_PATH), 'github-issues initial app.json')
      await fs.outputJSON(VANT_OUTPUT_PATH, { component: true })
      await dev.waitFor(
        new Promise(resolve => setTimeout(resolve, 1_500)),
        'generated output watch quiet period',
      )

      await expect(fs.pathExists(WATCH_PROBE_MARKER)).resolves.toBe(false)
    }
    finally {
      await dev.stop(5_000)
    }
  })
})
