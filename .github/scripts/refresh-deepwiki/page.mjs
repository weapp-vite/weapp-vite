import { acceptedPattern } from './state.mjs'

const deepWikiUrl = 'https://deepwiki.com/weapp-vite/weapp-vite'
const refreshName = /^Refresh(?: this wiki)?$/i

export function createPageAdapter(page) {
  let httpStatus = null
  const visible = locator => locator.filter({ visible: true })
  const officialControl = async () => {
    const button = visible(page.getByRole('button', { name: refreshName }))
    return await button.count() > 0 ? button.first() : visible(page.getByRole('link', { name: refreshName })).first()
  }
  return {
    async navigate() {
      const response = await page.goto(deepWikiUrl, { waitUntil: 'domcontentloaded' })
      httpStatus = response?.status() ?? null
    },
    async inspect() {
      // 策略读取完整可见观察；只有报告序列化可以裁剪诊断，不能隐藏末尾认证门槛。
      // eslint-disable-next-line unicorn/prefer-dom-node-text-content -- Playwright 的可见正文排除隐藏脚本和隐藏认证模板，避免误判刷新结果。
      const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
      return {
        httpStatus,
        url: page.url().split(/[?#]/)[0],
        title: await page.title(),
        bodyText: bodyText ?? '',
        controls: (await visible(page.getByRole('button').or(page.getByRole('link'))).allTextContents()).map(text => text.trim()),
        headings: (await visible(page.getByRole('heading')).allTextContents()).map(text => text.trim()),
      }
    },
    async waitForIndex(timeout) {
      const row = visible(page.getByText(/Last indexed:/)).first()
      await row.waitFor({ timeout })
      // 日期与提交取自同一可见状态行，不能将显示用短 SHA 当作链接中的完整前缀。
      return row.evaluate((element) => {
        const link = element.querySelector('a[href*="github.com/weapp-vite/weapp-vite/commits/"]')
        return { text: element.textContent ?? '', href: link?.getAttribute('href') ?? '' }
      })
    },
    async hasOfficialRefreshControl() {
      return await (await officialControl()).count() > 0
    },
    async clickOfficialRefreshControl() {
      await (await officialControl()).click()
    },
    async waitForRefreshResult() {
      await visible(page.getByText(acceptedPattern)).first().waitFor({ timeout: 3_000 }).catch((error) => {
        if (error.name !== 'TimeoutError') {
          throw error
        }
      })
    },
  }
}
