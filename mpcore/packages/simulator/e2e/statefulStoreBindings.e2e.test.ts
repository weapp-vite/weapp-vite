// @ts-expect-error Node 侧编译真实 stateful HMR SFC 后注入虚拟文件。
import sources from 'virtual:stateful-store-binding-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders live Store values across template restoration and SFC page relaunch', async () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const count = (selector: string) => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return preview.querySelector(selector)?.textContent
  }
  try {
    const page = session.reLaunch('/pages/wevu/index')
    expect(count('.store-count')).toBe('0')
    page.increment()
    page.increment()
    await expect.poll(() => count('.store-count')).toBe('2')
    expect(count('.count')).toBe('2')
    const templatePath = 'pages/wevu/index.wxml'
    const original = files.get(templatePath)!
    const updated = `<view class="template-probe">template edit</view>${original}`
    let expectedCount = 2
    for (const template of [updated, original]) {
      files.set(templatePath, template)
      expect(count('.template-probe')).toBe(template === updated ? 'template edit' : undefined)
      expect(session.getCurrentPages()[0]).toBe(page)
      page.increment()
      expectedCount += 1
      await expect.poll(() => count('.store-count')).toBe(String(expectedCount))
      expect(count('.count')).toBe(String(expectedCount))
    }
    session.reLaunch('/pages/wevu/index')
    expect(count('.store-count')).toBe('4')
    expect(count('.count')).toBe('0')
  }
  finally {
    session.close()
    preview.remove()
  }
})
