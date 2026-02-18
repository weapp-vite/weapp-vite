import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')

const PLATFORM_OUTPUTS = [
  { platform: 'weapp', templateExt: 'wxml', scriptExt: 'wxs', eventAttr: 'bind:tap', scriptTag: '<wxs' },
  { platform: 'alipay', templateExt: 'axml', scriptExt: 'sjs', eventAttr: 'onTap', scriptTag: '<import-sjs' },
  { platform: 'tt', templateExt: 'ttml', scriptExt: 'wxs', eventAttr: 'bind:tap', scriptTag: '<wxs' },
  { platform: 'swan', templateExt: 'swan', scriptExt: 'sjs', eventAttr: 'bind:tap', scriptTag: '<sjs' },
  { platform: 'jd', templateExt: 'jxml', scriptExt: 'wxs', eventAttr: 'bind:tap', scriptTag: '<wxs' },
  { platform: 'xhs', templateExt: 'xhsml', scriptExt: 'wxs', eventAttr: 'bind:tap', scriptTag: '<wxs' },
]

async function runBuild(root: string, platform: string) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', platform, '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('platform build outputs (e2e baseline)', () => {
  it.each(PLATFORM_OUTPUTS)('builds base app for $platform', async ({
    platform,
    templateExt,
    scriptExt,
    eventAttr,
    scriptTag,
  }) => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)

    await runBuild(BASE_APP_ROOT, platform)

    const templateFile = path.join(outputRoot, `pages/index/index.${templateExt}`)
    const scriptFile = path.join(outputRoot, `pages/index/utils.${scriptExt}`)

    expect(await fs.pathExists(templateFile)).toBe(true)
    expect(await fs.pathExists(scriptFile)).toBe(true)

    const templateContent = await fs.readFile(templateFile, 'utf8')
    expect(templateContent).toContain(`./card.${templateExt}`)
    expect(templateContent).toContain(eventAttr)
    expect(templateContent).toContain(scriptTag)
    if (scriptExt === 'sjs') {
      expect(templateContent).toContain('./utils.sjs')
      return
    }
    expect(templateContent).toContain('./utils.wxs')
  })
})
