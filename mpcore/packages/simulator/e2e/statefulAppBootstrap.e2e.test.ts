// @ts-expect-error Node 侧生成真实 Wevu App 与 stateful banner，由浏览器消费。
import sources from 'virtual:stateful-app-bootstrap-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('boots App and page after each full stateful runtime replacement', () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let boot = 0; boot < 2; boot++) {
      const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
      try {
        session.reLaunch('/pages/index/index')
        preview.innerHTML = session.renderCurrentPage().wxml
        expect(preview.querySelector('#app-state')?.textContent).toBe('1')
        const app = session.getApp()
        session.reLaunch('/pages/index/index')
        expect(session.getApp()).toBe(app)
        expect(app?.launches).toBe(1)
      }
      finally {
        session.close()
      }
    }
  }
  finally {
    preview.remove()
  }
})
