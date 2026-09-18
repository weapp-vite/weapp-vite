import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { initialConditionalBranchEvents, initialConditionalBranchFiles } from '../test/helpers/initialConditionalBranch'

it('keeps replaced initial branches out of the DOM while preserving their native ready', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(initialConditionalBranchFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.inspect()).toEqual(initialConditionalBranchEvents)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#column')?.textContent).toContain('Alpha')
    expect(preview.querySelector('#row')).toBeNull()
    expect(page.inspect()).toEqual(initialConditionalBranchEvents)
  }
  finally {
    session.close()
    preview.remove()
  }
})
