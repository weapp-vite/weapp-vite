import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { deferredMountFiles } from '../test/helpers/deferredMount'

it.each(['allow', 'abort', 'reject'])('renders the initial host DOM independently of deferred mounting: %s', async (outcome) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(deferredMountFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#guard-title')?.textContent).toBe('async guard')
    expect(preview.querySelector('#mounted-trace')?.textContent).toBe('pending')

    await page.completeGuard(outcome)

    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#guard-title')?.textContent).toBe('async guard')
    expect(preview.querySelector('#mounted-trace')?.textContent).toBe(outcome === 'allow' ? 'guard:start > guard:done > mounted' : 'pending')
    expect(session.getApp()?.globalData.events).toEqual(outcome === 'allow' ? ['guard:start', 'guard:done', 'mounted'] : ['guard:start', 'guard:done'])
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
