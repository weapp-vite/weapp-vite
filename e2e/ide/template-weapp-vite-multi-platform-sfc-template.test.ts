import path from 'pathe'
import { expect } from 'vitest'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-sfc-template',
)

describe('template e2e: weapp-vite-multi-platform-sfc-template', { concurrent: false }, () => {
  it('renders and updates the WeChat SFC target', async () => {
    await runTemplateE2E({
      buildPlatform: 'weapp',
      distRoot: 'dist/weapp/dist',
      ideProjectRoot: 'dist/weapp',
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-multi-platform-sfc-template',
      async runtimeAssert(page, pagePath) {
        if (pagePath !== 'pages/index/index') {
          return
        }

        await expect(page.data()).resolves.toMatchObject({
          count: 0,
          doubled: 0,
          platform: 'weapp',
          status: 'ready',
        })
        const platformCard = await page.$('platform-card')
        expect(platformCard).toBeTruthy()
        await expect(platformCard.data()).resolves.toMatchObject({
          platform: 'weapp',
          platformLabel: 'weapp',
        })

        const button = await page.$('#increment-button')
        expect(button).toBeTruthy()
        await button.tap()
        await expect.poll(async () => {
          const data = await page.data()
          return { count: data.count, doubled: data.doubled }
        }).toEqual({ count: 1, doubled: 2 })
      },
    })
  })
})
