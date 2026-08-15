import path from 'pathe'
import { expect } from 'vitest'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-template',
)

describe.sequential('template e2e: weapp-vite-multi-platform-template', () => {
  it('renders and updates the WeChat target', async () => {
    await runTemplateE2E({
      buildPlatform: 'weapp',
      distRoot: 'dist/weapp/dist',
      ideProjectRoot: 'dist/weapp',
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-multi-platform-template',
      async runtimeAssert(page, pagePath) {
        if (pagePath !== 'pages/index/index') {
          return
        }

        await expect(page.data()).resolves.toMatchObject({
          count: 0,
          platform: 'weapp',
          status: 'ready',
        })
        const button = await page.$('#increment-button')
        expect(button).toBeTruthy()
        await button.tap()
        await expect.poll(async () => (await page.data()).count).toBe(1)
      },
    })
  })
})
