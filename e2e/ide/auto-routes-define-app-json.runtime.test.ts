import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')

async function runBuild() {
  const outputRoot = path.join(APP_ROOT, 'dist')
  await fs.remove(outputRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    label: 'ide:auto-routes-define-app-json',
  })
}

async function waitForRouteLinks(page: any, timeoutMs = 12_000, intervalMs = 240) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const routeLinks = await page.data('routeLinks')
    if (Array.isArray(routeLinks) && routeLinks.length > 0) {
      return routeLinks
    }
    await page.waitFor(intervalMs)
  }
  return []
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

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('auto-routes define app json runtime (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders routeLinks for home page with main package and subpackage routes', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await miniProgram.reLaunch('/pages/home/index')
      if (!page) {
        throw new Error('Failed to launch /pages/home/index')
      }

      const routeLinks = await waitForRouteLinks(page)
      expect(routeLinks.length).toBeGreaterThan(0)

      const routes = routeLinks
        .map((item: any) => item?.route)
        .filter((item: unknown): item is string => typeof item === 'string')

      expect(routes).toContain('pages/home/index')
      expect(routes).toContain('subpackages/lab/pages/state-playground/index')
      expect(routes).toContain('subpackages/marketing/pages/campaign/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
