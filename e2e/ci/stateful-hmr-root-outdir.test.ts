import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/stateful-hmr-root-tailwind')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

interface AppConfig {
  pages?: string[]
  subPackages?: Array<{
    independent?: boolean
    pages?: string[]
    root?: string
  }>
}

async function waitForCompleteInitialBundle(timeoutMs = 20_000) {
  const appJsonPath = path.join(DIST_ROOT, 'app.json')
  const appJsPath = path.join(DIST_ROOT, 'app.js')
  const controlPath = path.join(DIST_ROOT, '__weapp_vite_hmr/control.js')
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (
      await fs.pathExists(appJsPath)
      && await fs.pathExists(appJsonPath)
      && await fs.pathExists(controlPath)
    ) {
      try {
        return await fs.readJSON(appJsonPath) as AppConfig
      }
      catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for complete stateful HMR initial bundle.')
}

describe.sequential('stateful HMR with root source directory', () => {
  beforeEach(async () => {
    await cleanupResidualDevProcesses()
    await fs.remove(DIST_ROOT)
  })

  afterEach(async () => {
    await cleanupResidualDevProcesses()
  })

  it('ignores generated output and commits the complete initial bundle', async () => {
    const dev = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })

    try {
      const appConfig = await dev.waitFor(
        waitForCompleteInitialBundle(),
        'complete stateful root-source initial bundle',
      )
      expect(appConfig).toMatchObject({
        pages: ['pages/index/index'],
        subPackages: [
          {
            pages: ['pages/index'],
            root: 'sub-normal',
          },
          {
            independent: true,
            pages: ['pages/index'],
            root: 'sub-independent',
          },
        ],
      })
      await expect(fs.pathExists(path.join(DIST_ROOT, 'app.js'))).resolves.toBe(true)
      await expect(fs.readFile(path.join(DIST_ROOT, 'app.wxss'), 'utf8')).resolves.toContain('--color-brand: #006241')
      await expect(fs.readFile(path.join(DIST_ROOT, 'sub-normal/pages/index.wxss'), 'utf8')).resolves.toContain('.text-red-500')
      await expect(fs.readFile(path.join(DIST_ROOT, 'sub-independent/pages/index.wxss'), 'utf8')).resolves.toContain('.text-blue-500')
    }
    finally {
      await dev.stop(5_000)
    }

    await expect(fs.pathExists(path.join(DIST_ROOT, 'app.json'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(DIST_ROOT, 'app.js'))).resolves.toBe(true)
  })
})
