import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentArtifactReadFiles } from '../test/helpers/componentArtifactReads'

it('resolves npm component modules and required source while preserving rendered updates and component identity in a browser', () => {
  const files = createBrowserVirtualFiles(componentArtifactReadFiles)
  const read = vi.spyOn(files, 'get')
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    session.reLaunch('/pages/index/index')
    const component = session.selectComponent('#probe')!
    render()
    expect(component.data).toMatchObject({ label: 'module-source-loaded', relativeLabel: 'relative-directory-source', npmLabel: 'npm-directory-source', count: 0 })
    expect(preview.querySelector('#probe #probe-label')?.textContent).toBe('module-source-loaded/0')
    expect(preview.querySelector('#probe #directory-labels')?.textContent).toBe('relative-directory-source/npm-directory-source')

    for (const count of [1, 2]) {
      component.setData({ count })
      render()
      expect(preview.querySelector('#probe #probe-label')?.textContent).toBe(`module-source-loaded/${count}`)
      expect(preview.querySelector('#probe #directory-labels')?.textContent).toBe('relative-directory-source/npm-directory-source')
      expect(session.selectComponent('#probe')).toBe(component)
      expect(component.data).toMatchObject({ label: 'module-source-loaded', count })
    }
    expect(session.getDiagnostics()).toEqual([])
    expect(read.mock.calls.filter(([file]) => file.includes('unused-card'))).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
