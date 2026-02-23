import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')

function hasClassGroup(wxml: string, required: string[]) {
  const classAttributes = [...wxml.matchAll(/class="([^"]+)"/g)].map(match => match[1])
  return classAttributes.some((classValue) => {
    const normalized = classValue.split(/\s+/).filter(Boolean)
    return required.every(className => normalized.includes(className))
  })
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-dynamic-bindings',
  })
}

describe.sequential('template e2e: weapp-vite-wevu-template dynamic object/array class style', () => {
  it('supports object and array bindings merged with static class/style', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: TEMPLATE_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch index page')
      }

      const initialRoot = await page.$('page')
      if (!initialRoot) {
        throw new Error('Failed to find page element')
      }
      const initialWxml = await initialRoot.wxml()

      expect(hasClassGroup(initialWxml, ['page'])).toBe(true)
      expect(hasClassGroup(initialWxml, ['card'])).toBe(true)
      expect(hasClassGroup(initialWxml, ['btn', 'primary'])).toBe(true)

      await page.callMethod('increment')
      await page.waitFor(120)

      const updatedRoot = await page.$('page')
      if (!updatedRoot) {
        throw new Error('Failed to find page element after increment')
      }
      const updatedWxml = await updatedRoot.wxml()
      expect(hasClassGroup(updatedWxml, ['page', 'page-energetic'])).toBe(true)
      expect(updatedWxml).toMatch(/background:\s*#eaf0ff\s*;/)
      expect(updatedWxml).toMatch(/border-top:\s*(?:4rpx|2px)\s+solid\s+#4c6ef5\s*;?/)
      expect(hasClassGroup(updatedWxml, ['card', 'card-active'])).toBe(true)
      expect(updatedWxml).toMatch(/border-color:\s*#4c6ef5\s*;?/)
      expect(hasClassGroup(updatedWxml, ['btn', 'primary', 'btn-boost'])).toBe(true)
      expect(updatedWxml).toMatch(/opacity:\s*0\.88\s*;?/)
      expect(updatedWxml).toMatch(/box-shadow:\s*0\s+(?:8rpx|4px)\s+(?:20rpx|10px)\s+rgba\(76,\s*110,\s*245,\s*0\.28\)\s*;?/)
    }
    finally {
      await miniProgram.close()
    }
  })
})
