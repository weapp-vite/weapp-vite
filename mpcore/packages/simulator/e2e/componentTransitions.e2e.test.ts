import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentTransitionFiles } from '../test/helpers/componentTransitions'

it('opens and closes a rendered component through behavior property observers', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentTransitionFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#dialog-title')).toBeNull()
    const dialog = page.selectComponent!('#dialog')
    dialog.setData({ visible: true, label: 'Confirm dialog' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#dialog-title')?.textContent).toBe('Confirm dialog')
    const close = preview.querySelector('#dialog-close')!
    session.callScopeMethod(close.getAttribute('data-sim-scope')!, close.getAttribute('data-sim-tap')!, {})
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#dialog-title')).toBeNull()
    expect(dialog.properties.visible).toBe(false)
  }
  finally {
    session.close()
    preview.remove()
  }
})
