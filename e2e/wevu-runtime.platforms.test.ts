import type { RuntimePlatform } from './wevu-runtime.utils'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  DIST_ROOT,
  formatMarkup,
  formatStyle,
  loadAppConfig,
  readPageOutput,
  resolvePages,
  runBuild,

} from './wevu-runtime.utils'

const PLATFORM_LIST: RuntimePlatform[] = ['alipay', 'tt']

const PLATFORM_STYLE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxss',
  alipay: 'acss',
  tt: 'ttss',
}

describe.sequential('wevu runtime platform outputs', () => {
  it.each(PLATFORM_LIST)('builds and snapshots %s outputs', async (platform) => {
    const config = await loadAppConfig()
    const pages = resolvePages(config)

    await runBuild(platform)

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appStylePath = path.join(DIST_ROOT, `app.${PLATFORM_STYLE_EXT[platform]}`)
    if (await fs.pathExists(appStylePath)) {
      const appStyle = await fs.readFile(appStylePath, 'utf-8')
      expect(formatStyle(appStyle)).toMatchSnapshot(`wevu-runtime::${platform}::app.style`)
    }

    for (const pagePath of pages) {
      const { template, style } = await readPageOutput(platform, pagePath)
      expect(formatMarkup(template)).toMatchSnapshot(`wevu-runtime::${platform}::${pagePath}`)
      expect(formatStyle(style)).toMatchSnapshot(`wevu-runtime::${platform}::${pagePath}.style`)
    }
  })
})
