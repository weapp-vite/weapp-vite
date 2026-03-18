import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-340-hoist')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:issue-340-hoist',
    skipNpm: true,
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }

  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }

  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('e2e app: issue-340-hoist runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reLaunches both subpackage pages with hoisted shared imports intact', async () => {
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')

    const miniProgram = await getSharedMiniProgram()
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')

    expect(itemPageJs).toContain('item-login-required:issue-340-hoist:shared')
    expect(userPageJs).toContain('user-register-form:issue-340-hoist:shared')

    const itemPage = await miniProgram.reLaunch('/subpackages/item/login-required/index')
    if (!itemPage) {
      throw new Error('Failed to launch issue-340-hoist item page')
    }
    await itemPage.waitFor(500)
    const itemResult = await itemPage.callMethod('_runE2E')
    expect(itemResult?.ok).toBe(true)
    expect(itemResult?.message).toBe('item-login-required:issue-340-hoist:shared')

    const userPage = await miniProgram.reLaunch('/subpackages/user/register/form')
    if (!userPage) {
      throw new Error('Failed to launch issue-340-hoist user page')
    }
    await userPage.waitFor(500)
    const userResult = await userPage.callMethod('_runE2E')
    expect(userResult?.ok).toBe(true)
    expect(userResult?.message).toBe('user-register-form:issue-340-hoist:shared')
  })
})
