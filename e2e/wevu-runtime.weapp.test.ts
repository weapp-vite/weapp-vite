import { describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'
import {
  APP_ROOT,
  formatMarkup,
  loadAppConfig,
  normalizeAutomatorWxml,
  resolvePages,
  runBuild,
} from './wevu-runtime.utils'

function getPageOrder(pages: string[]) {
  return pages
}

describe.sequential('wevu runtime (weapp e2e)', () => {
  it('runs all pages and snapshots WXML', async () => {
    const config = await loadAppConfig()
    const pages = getPageOrder(resolvePages(config))

    await runBuild('weapp')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      for (const pagePath of pages) {
        const route = `/${pagePath}`
        const page = await miniProgram.reLaunch(route)
        if (!page) {
          throw new Error(`Failed to launch page: ${route}`)
        }

        const result = await page.callMethod('runE2E')
        if (!result?.ok) {
          throw new Error(`E2E failed for ${pagePath}: ${JSON.stringify(result)}`)
        }
        expect(result.ok).toBe(true)

        const element = await page.$('page')
        if (!element) {
          throw new Error(`Missing page element for ${route}`)
        }
        const wxml = normalizeAutomatorWxml(await element.wxml())
        expect(await formatMarkup(wxml)).toMatchSnapshot(`wevu-runtime::${pagePath}`)
      }
    }
    finally {
      await miniProgram.close()
    }
  })
})
