import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { omittedAppFiles } from '../test/helpers/omittedApp'

describe('optional App registration browser rendering', () => {
  it('renders the first page and subpackage routes with a shared default app', () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(omittedAppFiles()) })
    const preview = document.createElement('div')
    document.body.append(preview)
    try {
      session.reLaunch('/pages/index/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#app-state')?.textContent).toBe('ready:1:entry')
      session.reLaunch('/packageA/pages/detail')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelectorAll('#app-state')).toHaveLength(1)
      expect(preview.querySelector('#app-state')?.textContent).toBe('ready:2:entry')
      session.reLaunch('/pages/index/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#app-state')?.textContent).toBe('ready:3:entry')
    }
    finally {
      session.close()
      preview.remove()
    }
  })
})
