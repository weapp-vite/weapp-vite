import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { sharedModuleStateFiles } from '../test/helpers/sharedModuleState'

it('renders new page-local data together with unchanged shared module state', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sharedModuleStateFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const first = session.reLaunch('/pages/first/index')
    first.increment()
    session.reLaunch('/pages/second/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#marker')?.textContent).toBe('second')
    expect(preview.querySelector('#count')?.textContent).toBe('1')
    expect(preview.querySelector('#local')?.textContent).toBe('0')
  }
  finally {
    session.close()
    preview.remove()
  }
})
