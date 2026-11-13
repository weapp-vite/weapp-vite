import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { initialPropertiesFiles } from '../test/helpers/initialProperties'
import { initialPropertiesExpectedTrace } from '../test/helpers/initialPropertiesExpectations'
import { stringPropertyWarning, stringPropertyWarningFiles } from '../test/helpers/stringPropertyWarning'

it('renders the IDE initial property and observer order before and after an update', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(initialPropertiesFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    session.renderCurrentPage()
    page.capture()
    for (const updated of [false, true]) {
      if (updated) {
        page.advance()
      }
      const expected = initialPropertiesExpectedTrace(updated)
      await vi.waitFor(() => expect(page.data.events).toEqual(expected))
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(JSON.parse(preview.querySelector('.probe-summary')!.textContent!)).toEqual(expected)
      expect([...preview.querySelectorAll('.component-state')].map(node => node.textContent)).toEqual(Array.from({ length: 2 }).fill(updated ? 'updated-a/1' : 'incoming-a/0'))
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('shows native String null warnings without warning for defaults or repeating render passes', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(stringPropertyWarningFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect([...preview.querySelectorAll('.value')].map(node => node.textContent)).toEqual(['', '', 'valid'])
    expect(session.getDiagnostics().map(entry => entry.args[0])).toEqual([stringPropertyWarning])
    page.update('ready')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('.value')!.textContent).toBe('ready')
    expect(session.getDiagnostics()).toHaveLength(1)
    page.update(null)
    session.renderCurrentPage()
    expect(session.getDiagnostics().map(entry => entry.args[0])).toEqual([stringPropertyWarning, stringPropertyWarning])
  }
  finally {
    session.close()
    preview.remove()
  }
})
