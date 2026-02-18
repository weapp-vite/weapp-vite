import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createDevProcessEnv } from './utils/dev-process-env'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/style-import-vue')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const WXSS_PATH = path.join(DIST_ROOT, 'pages/index/index.wxss')
const EXPECTED_MARKERS = ['.hello-import', '.scss-imported', '.external-src']

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
    const devProcess = execa('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })
    const devProcessExit = devProcess.catch(() => {})

    try {
      const wxss = await waitForFileContains(WXSS_PATH, EXPECTED_MARKERS)
      for (const marker of EXPECTED_MARKERS) {
        expect(wxss).toContain(marker)
      }
    }
    finally {
      devProcess.kill('SIGTERM')
      const killTimer = setTimeout(() => {
        devProcess.kill('SIGKILL')
      }, 2_000)
      await devProcessExit
      clearTimeout(killTimer)
    }
  })
})
