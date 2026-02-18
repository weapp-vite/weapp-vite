import type { RuntimePlatform } from '../wevu-runtime.utils'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  DIST_ROOT,
  filterSnapshotPages,
  formatMarkup,
  formatStyle,
  loadAppConfig,
  readPageOutput,
  resolvePages,
  runBuild,

} from '../wevu-runtime.utils'

const PLATFORM_LIST: RuntimePlatform[] = ['alipay', 'tt']

const PLATFORM_STYLE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxss',
  alipay: 'acss',
  tt: 'ttss',
}

describe.sequential('wevu runtime platform outputs', () => {
  it.each(PLATFORM_LIST)('builds and snapshots %s outputs', async (platform) => {
    const config = await loadAppConfig()
    const pages = filterSnapshotPages(resolvePages(config))

    await runBuild(platform)

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appStylePath = path.join(DIST_ROOT, `app.${PLATFORM_STYLE_EXT[platform]}`)
    if (await fs.pathExists(appStylePath)) {
      const appStyle = await fs.readFile(appStylePath, 'utf-8')
      expect(await formatStyle(appStyle)).toMatchSnapshot(`wevu-runtime::${platform}::app.style`)
    }

    for (const pagePath of pages) {
      const { template, style } = await readPageOutput(platform, pagePath)
      expect(await formatMarkup(template)).toMatchSnapshot(`wevu-runtime::${platform}::${pagePath}`)
      expect(await formatStyle(style)).toMatchSnapshot(`wevu-runtime::${platform}::${pagePath}.style`)

      if (pagePath === 'pages/root-guard/index') {
        const scriptPath = path.join(DIST_ROOT, `${pagePath}.js`)
        const scriptSource = await fs.readFile(scriptPath, 'utf-8')
        expect(scriptSource).toMatch(/this\.root(?:\)\.a|\.a)/)
        expect(scriptSource).toMatch(/try\s*\{return/)
        expect(scriptSource).toMatch(/catch(?:\([^)]*\))?\{return``\}/)
      }
    }
  })
})
