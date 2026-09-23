// @ts-expect-error Node 侧构建两版真实 Store 定义后注入虚拟文件。
import sources from 'virtual:store-definition-reload-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders fresh Store defaults and plugin records only after restarting the App', () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const initial = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    initial.reLaunch('/pages/initial/index')
    initial.reLaunch('/pages/updated/index')
    preview.innerHTML = initial.renderCurrentPage().wxml
    expect(preview.querySelector('#name')?.textContent).toBe('init')
    initial.close()
    files.set('app.js', 'const r = require(\'./runtime.js\'); r.createApp({}).use(r.updated.initStoreManager());')
    const restarted = createBrowserHeadlessSession({ files })
    try {
      restarted.reLaunch('/pages/updated/index')
      preview.innerHTML = restarted.renderCurrentPage().wxml
      expect(preview.querySelector('#name')?.textContent).toBe('updated-default')
      expect(preview.querySelector('#plugin')?.textContent).toBe('true')
    }
    finally {
      restarted.close()
    }
  }
  finally {
    initial.close()
    preview.remove()
  }
})
