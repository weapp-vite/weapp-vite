import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-subpackage-placement')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function waitForWxmlContains(page: any, text: string, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const wxml = await readPageWxml(page)
    if (wxml.includes(text)) {
      return wxml
    }
    await page.waitFor(220)
  }
  throw new Error(`Timed out waiting for text: ${text}`)
}

async function buildFixture() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:wevu-subpackage-placement',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await buildFixture()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      timeout: 120_000,
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

describe.sequential('e2e app: wevu-subpackage-placement', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reLaunches main, normal subpackage, and independent subpackage vue routes', async () => {
    const miniProgram = await getSharedMiniProgram()

    const routeCases = [
      {
        route: '/pages/index/index',
        ready: '__WSP_MAIN_VUE__',
        expected: ['main package vue card', 'main package native component'],
      },
      {
        route: '/subpackages/normal-wevu/pages/entry/index',
        ready: '__WSP_NORMAL_ENTRY__',
        expected: ['package: normal', 'count: 0', 'double: 0'],
      },
      {
        route: '/subpackages/normal-wevu/pages/detail/index',
        ready: '__WSP_NORMAL_DETAIL__',
        expected: ['from: direct'],
      },
      {
        route: '/subpackages/independent-wevu/pages/entry/index',
        ready: '__WSP_INDEPENDENT_ENTRY__',
        expected: ['package: independent', 'count: 10', 'double: 20'],
      },
      {
        route: '/subpackages/independent-wevu/pages/detail/index',
        ready: '__WSP_INDEPENDENT_DETAIL__',
        expected: ['from: direct'],
      },
    ]

    for (const routeCase of routeCases) {
      const page = await miniProgram.reLaunch(routeCase.route)
      if (!page) {
        throw new Error(`Failed to launch route: ${routeCase.route}`)
      }

      const wxml = await waitForWxmlContains(page, routeCase.ready)
      for (const token of routeCase.expected) {
        expect(wxml).toContain(token)
      }
    }
  })
})
