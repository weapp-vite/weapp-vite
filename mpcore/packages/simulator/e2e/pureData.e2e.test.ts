import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { pureDataExpectedSnapshot, pureDataFiles } from '../test/helpers/pureData'

it('renders native pure data filtering and observer behavior in Chromium', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(pureDataFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#pure-contract')!.textContent).toBe('updated||')
    const component = session.selectComponent('#probe')!
    expect(component.snapshot).toEqual(pureDataExpectedSnapshot)
    component.setData({ visible: 'next', _private: 'next-secret' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#pure-contract')!.textContent).toBe('next||')
    expect(component.data._private).toBe('next-secret')
  }
  finally {
    session.close()
    preview.remove()
  }
})
