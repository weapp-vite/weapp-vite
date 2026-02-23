import fs from 'fs-extra'
import path from 'pathe'
import { formatWxml } from '../template-e2e.utils'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeWxml(wxml: string) {
  return stripAutomatorOverlay(wxml).replace(/\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g, '')
}

async function runBuild(root: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: root,
    platform: 'weapp',
    skipNpm: true,
    label: `ide:index:${path.basename(root)}`,
  })
}

describe.sequential('e2e baseline app', () => {
  it('renders index page wxml', async () => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)
    await runBuild(BASE_APP_ROOT)

    const miniProgram = await launchAutomator({
      projectPath: BASE_APP_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch index page')
      }

      const element = await page.$('page')
      if (!element) {
        throw new Error('Failed to find page element')
      }

      const wxml = normalizeWxml(await element.wxml())
      expect(await formatWxml(wxml)).toMatchSnapshot('wxml')
    }
    finally {
      await miniProgram.close()
    }
  })
})
