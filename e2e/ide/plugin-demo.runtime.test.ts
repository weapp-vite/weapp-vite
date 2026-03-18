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

async function waitForPageContains(miniProgram: any, expectedText: string, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (page) {
        const wxml = await readPageWxml(page)
        if (wxml.includes(expectedText)) {
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

  it('loads host page, renders plugin public components, and opens both plugin pages without runtime errors', async () => {
    const miniProgram = await getSharedMiniProgram()
    const errorCollector = attachRuntimeErrorCollector(miniProgram)
    const marker = errorCollector.mark()

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch /pages/index/index')
      }

      await page.waitFor(500)

      const indexWxml = await readPageWxml(page)
      expect(indexWxml).toContain('插件能力混合演示')
      expect(indexWxml).toContain('宿主直接渲染插件公开 Vue SFC 组件')
      expect(indexWxml).toContain('plugin-private://wxb3d842a4a7e3440d/components/hello-component')
      expect(indexWxml).toContain('plugin-private://wxb3d842a4a7e3440d/components/native-meter')
      expect(indexWxml).toContain('插件页面支持 Vue SFC')
      expect(indexWxml).toContain('Plugin Native Meter')

      await tapElement(page, '.panel__button')
      const updatedIndexWxml = await readPageWxml(page)
      expect(updatedIndexWxml).toContain('84%')

      await tapElement(page, '.nav-card')
      const vuePluginPage = await waitForPageContains(miniProgram, '插件页直接使用 Vue SFC')
      expect(vuePluginPage).not.toBeNull()

      const vuePluginWxml = await readPageWxml(vuePluginPage)
      expect(vuePluginWxml).toContain('插件页直接使用 Vue SFC')
      expect(vuePluginWxml).toContain('插件页内直接消费 Vue SFC 公开组件')
      expect(vuePluginWxml).toContain('Vue SFC 页面中的 Native Meter')

      await tapElement(vuePluginPage, '.panel__button')
      const updatedVuePluginWxml = await readPageWxml(vuePluginPage)
      expect(updatedVuePluginWxml).toContain('100%')

      const relaunchedNativePage = await miniProgram.reLaunch('plugin://hello-plugin/native-playground')
      if (!relaunchedNativePage) {
        throw new Error('Failed to launch plugin://hello-plugin/native-playground')
      }

      const nativePluginPage = await waitForPageContains(miniProgram, '原生 `Page` 继续可用')
      expect(nativePluginPage).not.toBeNull()

      const nativePluginWxml = await readPageWxml(nativePluginPage)
      expect(nativePluginWxml).toContain('原生 `Page` 继续可用')
      expect(nativePluginWxml).toContain('原生页中组合插件 Vue SFC 组件')
      expect(nativePluginWxml).toContain('插件页支持 Vue SFC')

      await tapElement(nativePluginPage, '.panel__button')
      const updatedNativePluginWxml = await readPageWxml(nativePluginPage)
      expect(updatedNativePluginWxml).toContain('插件公开组件也可以是 Vue SFC')

      const runtimeErrors = errorCollector.getSince(marker)
      expect(runtimeErrors).toEqual([])
    }
    finally {
      errorCollector.dispose()
    }
  })
})
