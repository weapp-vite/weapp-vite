import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { instancePropertiesFiles } from '../test/helpers/instanceProperties'

it('renders page and component own data read through properties after parent updates', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(instancePropertiesFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    render()
    const card = page.selectComponent!('#card')
    expect(preview.querySelector('#page-summary')?.textContent).toBe('')
    expect(preview.querySelector('#component-summary')?.textContent).toBe('')
    page.setData({ 'pageValue': 'updated', 'nested.value': 'page-updated', 'added': 'page-added' })
    page.refreshSummary()
    card.setData({ 'ownLabel': 'updated', 'nested.value': 'component-updated', 'added': 'component-added' })
    page.setData({ parentCount: 5 })
    render()
    card.refreshSummary()
    render()

    expect(preview.querySelector('#page-summary')?.textContent).toBe('updated/page-updated/page-added')
    expect(preview.querySelector('#component-summary')?.textContent).toBe('updated/component-updated/component-added/5')
    expect(preview.querySelector('#observer-summary')?.textContent).toBe('2>5')
  }
  finally {
    session.close()
    preview.remove()
  }
})
