import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('exposes app tabBar entries to browser-runtime application code', () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({
        pages: ['pages/home/index', 'pages/tab/index'],
        tabBar: { list: [{ pagePath: 'pages/tab/index', text: 'Tab' }] },
      })],
      ['app.js', 'App({})'],
      ['pages/home/index.js', 'Page({ data: { tabPath: globalThis.__wxConfig.tabBar.list[0].pagePath } })'],
      ['pages/home/index.wxml', '<view>{{tabPath}}</view>'],
      ['pages/tab/index.js', 'Page({})'],
      ['pages/tab/index.wxml', '<view>tab</view>'],
    ]),
  })

  try {
    expect(session.reLaunch('/pages/home/index').data.tabPath).toBe('pages/tab/index.html')
  }
  finally {
    session.close()
  }
})
