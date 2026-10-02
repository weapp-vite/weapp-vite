import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { reactNativeInitialBindingFiles } from '../test/helpers/reactNativeInitialBindings'

it('renders a native component only once its React binding snapshot exists', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(reactNativeInitialBindingFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#number')).toBeNull()
    page.setData({ slots: { s0: { value: 0, enabled: false, label: '' } } })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#number')?.textContent).toBe('0:0')
    page.selectComponent!('#value').setData({ local: 7 })
    page.setData({ 'slots.s0.value': 2 })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#number')?.textContent).toBe('2:7')
    expect(session.getApp()?.globalData.attached).toEqual([{ value: 0, enabled: false, label: '' }])
  }
  finally {
    session.close()
    preview.remove()
  }
})
