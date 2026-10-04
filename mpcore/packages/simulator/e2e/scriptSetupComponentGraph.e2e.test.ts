import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createScriptSetupComponentGraphFiles, scriptSetupComponentGraphSteps } from '../test/helpers/scriptSetupComponentGraph'

it('shows the component selected by the rebuilt registration path and removes/restores it', () => {
  const container = document.createElement('div')
  document.body.append(container)
  try {
    for (const step of scriptSetupComponentGraphSteps) {
      const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createScriptSetupComponentGraphFiles(step)) })
      try {
        session.reLaunch('/pages/index/index')
        container.innerHTML = session.renderCurrentPage().wxml
        expect(container.querySelector('#external-marker')?.textContent).toBe(step.marker)
        expect(container.querySelector('#external-card')?.textContent?.trim() ?? null).toBe(step.text)
      }
      finally {
        session.close()
      }
    }
  }
  finally {
    container.remove()
  }
})
