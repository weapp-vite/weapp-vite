import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { templateUpdateFiles, templateUpdateSource, templateUpdateTitles } from '../test/helpers/templateUpdates'

it('renders four template file updates while preserving the interacted page and app', () => {
  const files = createBrowserVirtualFiles(templateUpdateFiles)
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const app = session.getApp()
    render()
    expect(preview.querySelector('#title')?.textContent).toBe('HMR')
    expect(preview.querySelector('#count')?.textContent).toBe('count: 0')
    const increment = preview.querySelector('#increment')!
    session.callScopeMethod(increment.getAttribute('data-sim-scope')!, increment.getAttribute('data-sim-tap')!, {})
    render()
    expect(preview.querySelector('#count')?.textContent).toBe('count: 1')
    for (const title of templateUpdateTitles.slice(1)) {
      const source = templateUpdateSource(title)
      expect(source.length).toBe(templateUpdateSource('HMR').length)
      files.set('pages/index/index.wxml', source)
      render()
      expect(preview.querySelector('#title')?.textContent).toBe(title)
      expect(preview.querySelector('#count')?.textContent).toBe('count: 1')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
