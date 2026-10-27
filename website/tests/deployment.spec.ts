import process from 'node:process'
import { expect, test } from 'playwright/test'

const preview = process.env.REPO_DOCS_CHANNEL !== 'stable'

test('文档渠道在首页、客户端导航和 404 保持一致', async ({ page }) => {
  await page.route(/https:\/\/(?:www\.googletagmanager\.com|hm\.baidu\.com)\//, route => route.fulfill({ body: '' }))
  await page.goto('/')
  const banner = page.locator('.docs-preview-banner')
  await expect(banner).toHaveCount(preview ? 1 : 0)
  await page.locator('.VPNavBarMenu').getByRole('link', { name: '指引', exact: true }).click()
  await expect(page).toHaveURL(/\/guide\/$/)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://vite.weapp.dev/guide/')
  if (preview) {
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive')
    await expect(banner.getByRole('link')).toHaveAttribute('href', 'https://vite.weapp.dev')
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await expect(banner).toBeVisible()
      await expect.poll(() => page.evaluate(() => {
        const notice = document.querySelector('.docs-preview-banner')!.getBoundingClientRect()
        const nav = document.querySelector('.VPNav')!.getBoundingClientRect()
        return notice.bottom <= nav.top && document.documentElement.scrollWidth <= innerWidth
      })).toBe(true)
    }
  }
  await page.goto('/unavailable-docs-channel-page')
  await expect(page.getByText('404', { exact: true })).toBeVisible()
  await expect(banner).toHaveCount(preview ? 1 : 0)
  if (preview) {
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive')
  }
})
