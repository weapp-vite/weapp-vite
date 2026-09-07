import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

describe('application global state in browser sessions', () => {
  it('shares application state with page modules and keeps sessions isolated', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', '{"pages":["pages/index/index"]}'],
      ['app.js', 'globalThis.counter = { value: 2 }; App({})'],
      ['pages/index/index.js', `Page({
        data: { label: '' },
        onLoad() { this.setData({ label: 'Count: ' + globalThis.counter.value }); },
        increment() {
          globalThis.counter.value += 3;
          this.setData({ label: 'Count: ' + globalThis.counter.value });
        },
      })`],
      ['pages/index/index.wxml', '<view id="counter">{{label}}</view>'],
    ])
    const first = createBrowserHeadlessSession({ files })
    const second = createBrowserHeadlessSession({ files })
    const preview = document.createElement('div')
    document.body.append(preview)
    const render = (session: typeof first) => {
      preview.innerHTML = session.renderCurrentPage().wxml
      return preview.querySelector('#counter')?.textContent
    }
    try {
      const page = first.reLaunch('/pages/index/index')
      expect(render(first)).toBe('Count: 2')
      page.increment()
      expect(render(first)).toBe('Count: 5')
      first.reLaunch('/pages/index/index')
      expect(render(first)).toBe('Count: 5')
      second.reLaunch('/pages/index/index')
      expect(render(second)).toBe('Count: 2')
    }
    finally {
      first.close()
      second.close()
      preview.remove()
    }
  })
})
