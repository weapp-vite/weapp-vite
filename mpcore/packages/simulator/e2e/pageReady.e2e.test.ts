import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { pageReadyFiles } from '../test/helpers/pageReady'

it('renders load microtask results at the later browser page ready boundary', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(pageReadyFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#ready-label')?.textContent).toBe('pending')
    await vi.waitFor(() => expect(page.data.label).toBe('async-loaded'))
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#ready-label')?.textContent).toBe('async-loaded')
    expect(session.getApp()?.globalData.events).toEqual(['load', 'show', 'loaded', 'ready', 'routeDone'])
  }
  finally {
    session.close()
    preview.remove()
  }
})
