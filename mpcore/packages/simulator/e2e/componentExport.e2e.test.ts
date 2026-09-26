import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentExportFiles, componentExportSnapshot } from '../test/helpers/componentExport'

it('renders custom component exports through the browser session native selectors', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentExportFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.inspect()).toEqual(componentExportSnapshot)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#result')?.textContent).toBe('exported')
    session.selectComponent('#exported')!.setData({ label: 'updated' })
    page.inspect()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#result')?.textContent).toBe('updated')
  }
  finally {
    session.close()
    preview.remove()
  }
})
