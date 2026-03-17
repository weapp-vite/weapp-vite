import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await fs.remove(PLUGIN_DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    label: 'ide:plugin-demo',
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

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  await element.tap()
  await page.waitFor(260)
}

async function waitForPluginPage(miniProgram: any, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (page) {
        const wxml = await readPageWxml(page)
        if (wxml.includes('This is a plugin page!')) {
          return page
        }
      }
    }
    catch {
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  return null
}

describe.sequential('plugin-demo runtime (ide)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('loads miniprogram page, renders plugin component, and opens plugin page without runtime errors', async () => {
    const miniProgram = await getSharedMiniProgram()
    const errorCollector = attachRuntimeErrorCollector(miniProgram)
    const marker = errorCollector.mark()

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch /pages/index/index')
      }

      await page.waitFor(400)
      await tapElement(page, '#add')

      const indexWxml = await readPageWxml(page)
      expect(indexWxml).toContain('Go to Plugin page')
      expect(indexWxml).toContain('plugin-private://wxb3d842a4a7e3440d/components/hello-component')

      await tapElement(page, '#nav')
      const pluginPage = await waitForPluginPage(miniProgram)
      expect(pluginPage).not.toBeNull()

      const pluginWxml = await readPageWxml(pluginPage)
      expect(pluginWxml).toContain('This is a plugin page!')

      const runtimeErrors = errorCollector.getSince(marker)
      expect(runtimeErrors).toEqual([])
    }
    finally {
      errorCollector.dispose()
    }
  })
})
