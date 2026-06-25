import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(REPO_ROOT, 'e2e-apps/vue-mini-issue151-wevu')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const ISSUE_151_ROUTE = '/pages/issue-151/index'
const BUILD_TIMEOUT = 120_000

let sharedMiniProgram: any = null

async function runBuild() {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    label: 'ide:vue-mini-issue151-wevu',
  })
}

async function waitForIssue151Ready(page: any) {
  let runtimeResult: any

  for (let attempt = 0; attempt < 20; attempt += 1) {
    runtimeResult = await page.callMethod('_runE2E')
    if (
      runtimeResult?.readyCount > 0
      && runtimeResult?.wevuHooksBucketType === 'array'
    ) {
      return runtimeResult
    }
    await page.waitFor(250)
  }

  return runtimeResult
}

describe.sequential('e2e app: vue-mini issue #151 / wevu', () => {
  beforeAll(async () => {
    await runBuild()
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
      warmupRoute: '/pages/index/index',
    })
  }, BUILD_TIMEOUT)

  afterAll(async () => {
    const miniProgram = sharedMiniProgram
    sharedMiniProgram = null
    await miniProgram?.close?.()
  })

  it('keeps onReady hooks isolated from PageInstance __onReady__ in base lib 3.16.2', async () => {
    const page = await sharedMiniProgram.switchTab(ISSUE_151_ROUTE)
    const runtimeResult = await waitForIssue151Ready(page)

    expect(runtimeResult).toMatchObject({
      ok: true,
      issue: 151,
      wevuHooksBucketType: 'array',
      tabBarReady: true,
      tabBarHooksType: 'array',
    })
    expect(runtimeResult.readyCount).toBeGreaterThan(0)
  })
})
