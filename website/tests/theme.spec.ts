import type { Locator } from 'playwright/test'
import { readFile } from 'node:fs/promises'
import { expect, test } from 'playwright/test'

async function expectHeadingNearTop(heading: Locator) {
  await expect.poll(() => heading.evaluate((el) => {
    const { top } = el.getBoundingClientRect()
    return top >= 0 && top < 200
  })).toBe(true)
}

test.beforeEach(async ({ page }) => {
  // 隔离第三方统计网络，不影响本地页面和资源的真实加载。
  await page.route(/https:\/\/(?:www\.googletagmanager\.com|hm\.baidu\.com)\//, route => route.fulfill({ body: '' }))
})

test('目录点击、历史导航和深链接由主题保持同步', async ({ page }) => {
  await page.goto('/guide/subpackage.html')
  await expect(page.locator('html')).toHaveClass(/wv-tech/)
  await expect(page.locator('.mermaid svg')).toHaveCount(7)
  const outline = page.locator('.VPDocAsideOutline')
  const hoist = outline.getByRole('link', { name: 'sharedStrategy = hoist', exact: true })
  await hoist.click()
  await expect(page).toHaveURL(/#sharedstrategy-hoist$/)
  await expect(hoist).toHaveClass(/active/)
  await expectHeadingNearTop(page.locator('#sharedstrategy-hoist'))

  await outline.getByRole('link', { name: '独立分包', exact: true }).click()
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toBe('#独立分包')
  await expectHeadingNearTop(page.locator('#独立分包'))
  await page.goBack()
  await expect(page).toHaveURL(/#sharedstrategy-hoist$/)
  // 首次历史导航会把 VitePress 的精简水合模块换成完整页面，等待异步图表重新挂载。
  await expect(page.locator('.mermaid svg')).toHaveCount(7)
  await expect(hoist).toHaveClass(/active/)
  await expectHeadingNearTop(page.locator('#sharedstrategy-hoist'))
  await page.goForward()
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toBe('#独立分包')
  await expectHeadingNearTop(page.locator('#独立分包'))
  await page.reload()
  await expect(page.locator('.mermaid svg')).toHaveCount(7)
  await expect(outline.getByRole('link', { name: '独立分包', exact: true })).toHaveClass(/active/)
  await expectHeadingNearTop(page.locator('#独立分包'))
})

test('窄桌面导航将溢出链接折叠且仍可访问', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/guide/')
  const extra = page.locator('.VPNavBarExtra')
  await extra.getByRole('button', { name: 'More options', exact: true }).click()
  const blog = extra.getByRole('link', { name: '博客', exact: true })
  await expect(blog).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await blog.click()
  await expect(page).toHaveURL(/\/blog\/release6.html$/)
  await expect(extra.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
})

test('移动导航覆盖完整视口且关闭按钮可点击', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/guide/')
  await expect(page.locator('html')).toHaveClass(/wv-tech/)
  const toggle = page.locator('.VPNavBarHamburger')
  const screen = page.locator('.VPNavScreen')
  await toggle.click()
  await expect(screen).toBeVisible()
  await expect.poll(() => screen.evaluate(el => Math.round(el.getBoundingClientRect().bottom))).toBe(844)
  await screen.getByRole('switch').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await toggle.click()
  await expect(screen).toBeHidden()
  await toggle.click()
  await screen.getByRole('link', { name: 'Wevu', exact: true }).click()
  await expect(page).toHaveURL(/\/wevu\/$/)
  await expect(screen).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('API 锚点导航保留侧栏高亮并支持移动端折叠', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/wevu/api/reactivity.html')
  await expect(page.locator('html')).toHaveClass(/wv-tech/)
  await page.locator('.VPLocalNav').getByRole('button', { name: 'Menu', exact: true }).click()
  const sidebar = page.locator('.VPSidebar')
  const link = sidebar.locator('a[href*="/wevu/api/reactivity"][href*="#"]').first()
  const href = await link.getAttribute('href')
  expect(href).toBeTruthy()
  await link.click()
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toBe(decodeURIComponent(new URL(href!, 'http://localhost').hash))
  await expect(link.locator('xpath=ancestor::*[contains(@class,"VPSidebarItem")][1]')).toHaveClass(/is-active/)
  await expect(sidebar).not.toHaveClass(/open/)
})

test('Mermaid 在首次加载、主题切换和客户端切页后保持渲染', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/guide/subpackage.html')
  const diagrams = page.locator('.mermaid svg')
  await expect(diagrams).toHaveCount(7)
  const ids = await diagrams.evaluateAll(elements => elements.map(el => el.id))
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-test', 'unrelated'))
  await expect(diagrams).toHaveCount(7)
  expect(await diagrams.evaluateAll(elements => elements.map(el => el.id))).toEqual(ids)
  await page.getByRole('switch', { name: 'Appearance' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => diagrams.evaluateAll(elements => elements.map(el => el.id)))
    .not
    .toEqual(expect.arrayContaining(ids))
  await expect(diagrams).toHaveCount(7)
  await page.locator('.VPSidebar').getByRole('link', { name: 'Alias 别名', exact: true }).click()
  await expect(page).toHaveURL(/\/guide\/alias.html$/)
  await page.locator('.VPSidebar').getByRole('link', { name: '分包指南', exact: true }).click()
  await expect(diagrams).toHaveCount(7)
  const darkIds = await diagrams.evaluateAll(elements => elements.map(el => el.id))
  await page.getByRole('switch', { name: 'Appearance' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect.poll(() => diagrams.evaluateAll(elements => elements.map(el => el.id)))
    .not
    .toEqual(expect.arrayContaining(darkIds))
  await expect(diagrams).toHaveCount(7)
  await expect(page.locator('.mermaid .error-icon')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('本地搜索导航后更新页面和 SEO head', async ({ page }) => {
  await page.goto('/guide/')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('searchbox').fill('分包')
  await page.locator('.VPLocalSearchBox a[href*="/guide/subpackage"]').first().click()
  await expect(page).toHaveURL(/\/guide\/subpackage\.html/)
  await expect(page.locator('.VPDoc h1')).toContainText('分包指南')
  await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/guide\/subpackage$/)
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', '分包指南')
})

test('代码组图标、复制代码和 Markdown 复制下载保持可用', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/guide/')
  const group = page.locator('.vp-code-group').first()
  await group.locator('label').filter({ hasText: /^npm$/ }).click()
  await expect(group.locator('.active code')).toHaveText('npm create weapp-vite@latest')
  await expect.poll(() => group.locator('label').filter({ hasText: /^npm$/ }).evaluate(el => getComputedStyle(el, '::before').backgroundImage)).not.toBe('none')
  await group.locator('.active button.copy').click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('npm create weapp-vite@latest')

  await page.getByRole('button', { name: 'Copy page', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('# 快速开始')
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.markdown-copy-buttons .download-btn').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('guide.md')
  expect(await readFile((await download.path())!, 'utf8')).toContain('# 快速开始')
})
