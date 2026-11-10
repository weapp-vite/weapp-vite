import sources from 'virtual:web-crypto-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders unique UUIDs across relaunches with an asynchronous mini-program host random API', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let index = 0; index < 2; index++) {
      session.reLaunch('/pages/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#crypto-state')?.textContent).toBe('0/true/true/true')
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
