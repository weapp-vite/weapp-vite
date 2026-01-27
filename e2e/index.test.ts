import { execa } from 'execa'
import fs from 'fs-extra'
import automator from 'miniprogram-automator'
import path from 'pathe'
import prettier from 'prettier'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/base')

export function formatWxml(wxml: string) {
  return prettier.format(wxml, {
    parser: 'html',
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    endOfLine: 'lf',
    trailingComma: 'none',
    printWidth: 180,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: 'ignore',
  })
}

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeWxml(wxml: string) {
  return stripAutomatorOverlay(wxml).replace(/\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g, '')
}

async function runBuild(root: string) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('e2e baseline app', () => {
  it('renders index page wxml', async () => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)
    await runBuild(BASE_APP_ROOT)

    const miniProgram = await automator.launch({
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
