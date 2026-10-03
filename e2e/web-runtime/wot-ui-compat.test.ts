import { expect } from 'vitest'
import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { defineComponentLibraryWebSuite } from '../component-library/webSuite'

defineComponentLibraryWebSuite({
  appRoot: 'e2e-apps/wot-ui-compat',
  baselineRoot: 'e2e/web-runtime/baselines/wot-ui-compat/web',
  componentFilterEnv: 'WOT_UI_COMPONENT_FILTER',
  defaultPort: 5182,
  expectedCount: 100,
  outputRoot: '.tmp/wot-ui-compat/web',
  portEnv: 'WOT_UI_WEB_E2E_PORT',
  progressEnv: 'WOT_UI_E2E_PROGRESS',
  progressLabel: 'wot-ui-web',
  scenarios: componentScenarios,
  serverPortEnv: 'WOT_UI_WEB_PORT',
  suiteName: 'Wot UI 2.3.2 Web 全组件兼容',
  updateBaselinesEnv: 'WOT_UI_UPDATE_BASELINES',
  async verifyRendered(page, scenario) {
    if (scenario.component !== 'wd-qr-code') {
      return
    }
    const canvas = page.locator('#e2e-target weapp-canvas canvas')
    await expect.poll(async () => canvas.evaluate((element) => {
      const node = element as HTMLCanvasElement
      const pixels = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
      let dark = 0
      let light = 0
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]! < 255) {
          continue
        }
        if (pixels[index]! < 64 && pixels[index + 1]! < 64 && pixels[index + 2]! < 64) {
          dark += 1
        }
        if (pixels[index]! > 192 && pixels[index + 1]! > 192 && pixels[index + 2]! > 192) {
          light += 1
        }
      }
      const area = node.width * node.height
      return { width: node.width, height: node.height, hasDarkModules: dark > area * 0.2, hasLightModules: light > area * 0.2 }
    }), { timeout: 10_000 }).toEqual({ width: 160, height: 160, hasDarkModules: true, hasLightModules: true })

    expect(await canvas.evaluate((element) => {
      const node = element as HTMLCanvasElement
      const host = (node.getRootNode() as ShadowRoot).host
      const before = node.toDataURL()
      host.setAttribute('disable-scroll', '')
      host.setAttribute('width', host.getAttribute('width')!)
      return node.toDataURL() === before
    })).toBe(true)
  },
})
