// @ts-expect-error Node 侧构建真实 IDE HMR 页面后注入虚拟文件。
import sources from 'virtual:store-hmr-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders changed Store actions and retained count from the real HMR page', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const count = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return preview.querySelector('#hmr-count')?.textContent
  }
  try {
    const page = session.reLaunch('/pages/hmr/index')
    expect(count()).toBe('count: 0')
    expect(await page.runE2E()).toMatchObject({ ok: true })
    expect(count()).toBe('count: 3')
    page.increment()
    await expect.poll(count).toBe('count: 5')
    session.reLaunch('/pages/hmr/index')
    expect(count()).toBe('count: 5')
  }
  finally {
    session.close()
    preview.remove()
  }
})
