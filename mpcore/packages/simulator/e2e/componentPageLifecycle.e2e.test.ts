import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentPageLifecycleFiles, componentPageLifecycleTrace } from '../test/helpers/componentPageLifecycle'

it('renders a child that reads its Component page context during attachment', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentPageLifecycleFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let index = 0; index < 2; index++) {
      const page = session.reLaunch('/pages/index/index')
      await new Promise(resolve => setTimeout(resolve, 0))
      page.snapshot()
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')?.textContent).toBe('page-provide-value')
      const trace = preview.querySelector('#lifecycle-trace')?.textContent?.split('|') ?? []
      expect(trace).toEqual(componentPageLifecycleTrace)
      session.reLaunch('/pages/empty/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')).toBeNull()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
