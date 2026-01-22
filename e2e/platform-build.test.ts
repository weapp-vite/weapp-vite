import os from 'node:os'
import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const FIXTURE_ROOT = path.resolve(import.meta.dirname, './fixtures/platform-minimal')
const APP_ROOT = path.resolve(import.meta.dirname, '../apps/wevu-vue-demo')

const PLATFORM_OUTPUTS = [
  { platform: 'weapp', templateExt: 'wxml', scriptExt: 'wxs', eventAttr: 'bind:tap' },
  { platform: 'alipay', templateExt: 'axml', scriptExt: 'sjs', eventAttr: 'onTap' },
  { platform: 'tt', templateExt: 'ttml', scriptExt: 'wxs', eventAttr: 'bind:tap' },
  { platform: 'swan', templateExt: 'swan', scriptExt: 'sjs', eventAttr: 'bind:tap' },
  { platform: 'jd', templateExt: 'jxml', scriptExt: 'wxs', eventAttr: 'bind:tap' },
  { platform: 'xhs', templateExt: 'xhsml', scriptExt: 'wxs', eventAttr: 'bind:tap' },
]

async function collectFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath))
    }
    else {
      files.push(entryPath)
    }
  }
  return files
}

async function runBuild(root: string, platform: string) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', platform, '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('platform build outputs (fixtures)', () => {
  it.each(PLATFORM_OUTPUTS)('builds minimal fixture for $platform', async ({ platform, templateExt, scriptExt, eventAttr }) => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `weapp-vite-${platform}-`))
    await fs.copy(FIXTURE_ROOT, tempRoot)
    try {
      await runBuild(tempRoot, platform)

      const outputRoot = path.join(tempRoot, 'dist')
      const templateFile = path.join(outputRoot, `pages/index/index.${templateExt}`)
      const scriptFile = path.join(outputRoot, `pages/index/utils.${scriptExt}`)

      expect(await fs.pathExists(templateFile)).toBe(true)
      expect(await fs.pathExists(scriptFile)).toBe(true)

      const templateContent = await fs.readFile(templateFile, 'utf8')
      expect(templateContent).toContain(`./card.${templateExt}`)
      expect(templateContent).toContain(eventAttr)
      if (scriptExt === 'sjs') {
        expect(templateContent).toContain('<sjs')
        expect(templateContent).toContain('./utils.sjs')
      }
      else {
        expect(templateContent).toContain('<wxs')
        expect(templateContent).toContain('./utils.wxs')
      }
    }
    finally {
      await fs.remove(tempRoot)
    }
  })
})

describe.sequential('platform build outputs (apps)', () => {
  it.each(PLATFORM_OUTPUTS)('builds app for $platform', async ({ platform, templateExt }) => {
    const outputRoot = path.join(APP_ROOT, 'dist')
    await fs.remove(outputRoot)
    await runBuild(APP_ROOT, platform)

    const files = await collectFiles(outputRoot)
    const hasTemplate = files.some(file => file.endsWith(`.${templateExt}`))
    expect(hasTemplate).toBe(true)
  })
})
