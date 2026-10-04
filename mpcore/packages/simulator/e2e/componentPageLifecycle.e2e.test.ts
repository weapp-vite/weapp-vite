import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentPageLifecycleFiles, componentPageLifecycleTrace } from '../test/helpers/componentPageLifecycle'

it('dispatches both Component page lifetime and page method callbacks', async () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/next/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Component({
  data: { lifecycle: [] },
  lifetimes: {
    ready() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'lifetime-ready'] })
    },
  },
  pageLifetimes: {
    show() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-show'] })
    },
    hide() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-hide'] })
    },
  },
  methods: {
    onShow() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-show'] })
    },
    onHide() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-hide'] })
    },
    onReady() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-ready'] })
    },
    openNext() {
      return new Promise((resolve, reject) => {
        wx.navigateTo({ url: '/pages/next/index', success: resolve, fail: reject })
      })
    },
  },
})
`],
      ['pages/index/index.wxml', '<view>{{lifecycle.join("|")}}</view>'],
      ['pages/next/index.js', 'Page({})'],
      ['pages/next/index.wxml', '<view>next</view>'],
    ]),
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(page.data.lifecycle).toEqual(['page-show', 'method-show', 'lifetime-ready', 'method-ready']))
    await page.openNext()
    expect(page.data.lifecycle).toEqual(['page-show', 'method-show', 'lifetime-ready', 'method-ready', 'page-hide', 'method-hide'])
  }
  finally {
    session.close()
  }
})

it('renders a child that reads its Component page context during attachment', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentPageLifecycleFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let index = 0; index < 2; index++) {
      const page = session.reLaunch('/pages/index/index')
      await new Promise(resolve => setTimeout(resolve, 0))
      page.snapshot()
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')?.textContent).toBe('page-provide-value')
      const trace = preview.querySelector('#lifecycle-trace')?.textContent?.split('|') ?? []
      expect(trace).toEqual(componentPageLifecycleTrace)
      session.reLaunch('/pages/empty/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')).toBeNull()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
