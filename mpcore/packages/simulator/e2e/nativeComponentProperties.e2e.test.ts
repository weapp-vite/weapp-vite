import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nativeComponentPropertiesFiles } from '../test/helpers/nativeComponentProperties'

it('renders only declared native properties while slots retain their owner data', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeComponentPropertiesFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#declared-title')?.textContent).toBe('attribute title')
    expect(preview.querySelector('#declared-subtitle')?.textContent).toBe('default subtitle')
    expect(preview.querySelector('#undeclared-title')?.textContent).toBe('')
    expect(preview.querySelector('#undeclared-subtitle')?.textContent).toBe('')
    expect(preview.querySelector('#slot-title')?.textContent).toBe('parent title')
    expect(preview.querySelector('#local-data')?.textContent).toBe('component data')

    page.setData({ passedTitle: 'updated attribute', title: 'updated parent' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#declared-title')?.textContent).toBe('updated attribute')
    expect(preview.querySelector('#undeclared-title')?.textContent).toBe('')
    expect(preview.querySelector('#slot-title')?.textContent).toBe('updated parent')
    expect(preview.querySelector('#undeclared')?.getAttribute('data-note')).toBe('host attribute')
  }
  finally {
    session.close()
    preview.remove()
  }
})
