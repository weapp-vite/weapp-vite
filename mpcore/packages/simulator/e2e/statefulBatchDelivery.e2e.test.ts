// @ts-expect-error Node 侧生成真实 HMR 客户端，浏览器执行同一批次确认协议。
import sources from 'virtual:stateful-batch-delivery-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders the applied batch and retains its version when the next batch fails', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    page.patch()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#utility')?.className).toBe('py-5_d5')
    expect(preview.querySelector('#utility')?.textContent).toBe('1')
    expect(page.reports().at(-1)).toMatchObject({ version: 1, payloads: ['app.js'] })
    page.failPatch()
    expect(page.reports().at(-1)).toMatchObject({ action: 'rebuild', version: 1 })
    expect(session.getCurrentPages()[0]).toBe(page)
  }
  finally {
    session.close()
    preview.remove()
  }
})
