/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(REPO_ROOT, 'test/fixture-projects/weapp-vite/shared-chunk-modes')
const MINI_OUT_DIR = 'dist-preserve-e2e'
const WEB_OUT_DIR = 'dist-preserve-web-e2e'

async function runBuild(platform: 'weapp' | 'web') {
  return await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    platform,
    '--skipNpm',
  ], {
    cwd: APP_ROOT,
    extendEnv: false,
    env: {
      ...sanitizeBuildCommandEnv(),
      WEAPP_PRESERVE_MODULES_E2E: 'true',
      WEAPP_PRESERVE_MODULES_OUT_DIR: MINI_OUT_DIR,
      WEAPP_PRESERVE_MODULES_WEB_OUT_DIR: WEB_OUT_DIR,
    },
    reject: false,
    timeout: 120_000,
  })
}

describe.sequential('preserveModules CLI build e2e', () => {
  it('preserves stable module paths in main, worker and Web builds', async () => {
    const miniRoot = path.join(APP_ROOT, MINI_OUT_DIR)
    const webRoot = path.join(APP_ROOT, WEB_OUT_DIR)
    await Promise.all([fs.remove(miniRoot), fs.remove(webRoot)])

    try {
      const miniResult = await runBuild('weapp')
      expect(miniResult.exitCode, miniResult.stderr || miniResult.stdout).toBe(0)
      await expect(fs.pathExists(path.join(miniRoot, 'shared/single.js'))).resolves.toBe(true)
      await expect(fs.pathExists(path.join(miniRoot, 'shared/single-leaf.js'))).resolves.toBe(true)

      const pageCode = await fs.readFile(path.join(miniRoot, 'pages/index/index.js'), 'utf8')
      const singleCode = await fs.readFile(path.join(miniRoot, 'shared/single.js'), 'utf8')
      const workerCode = await fs.readFile(path.join(miniRoot, 'workers/index.js'), 'utf8')
      expect(pageCode).toMatch(/shared\/single\.js/)
      expect(singleCode).toMatch(/\.\/single-leaf\.js/)
      expect(workerCode).toMatch(/(?:\.\/)?workers\/worker-shared-[^"']+\.js/)

      const webResult = await runBuild('web')
      expect(webResult.exitCode, webResult.stderr || webResult.stdout).toBe(0)
      await expect(fs.pathExists(path.join(webRoot, 'shared/single.js'))).resolves.toBe(true)
      await expect(fs.pathExists(path.join(webRoot, 'shared/single-leaf.js'))).resolves.toBe(true)
      expect(await fs.readFile(path.join(webRoot, 'shared/single.js'), 'utf8')).toMatch(/\.\/single-leaf\.js/)
    }
    finally {
      await Promise.all([fs.remove(miniRoot), fs.remove(webRoot)])
    }
  }, 180_000)
})
