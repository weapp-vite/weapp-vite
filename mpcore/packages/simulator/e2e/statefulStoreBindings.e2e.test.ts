// @ts-expect-error Node 侧编译真实 stateful HMR SFC 后注入虚拟文件。
import sources from 'virtual:stateful-store-binding-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders live Store values and preserves them across SFC page relaunch', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
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
    session.reLaunch('/pages/wevu/index')
    expect(count('.store-count')).toBe('2')
    expect(count('.count')).toBe('0')
  }
  finally {
    session.close()
    preview.remove()
  }
})
