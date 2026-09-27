import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { recursivePropsFiles } from '../test/helpers/recursiveProps'

it('renders a deep property patch and forwards input through the same recursive component instances', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(recursivePropsFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const render = () => {
      const tree = session.renderCurrentPage()
      preview.innerHTML = tree.wxml
      return new HeadlessTestingNodeHandle(tree.root, {
        callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
        createPageHandle: () => ({ data: async () => page.data }),
        createScopeHandle: () => null,
        ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
      })
    }
    render()
    expect(preview.querySelector('#leaf')?.textContent).toBe('initial')
    page.update()
    const root = render()
    expect(preview.querySelector('#leaf')?.textContent).toBe('updated')
    await (await root.getElementsByXpath('//input[@id="leaf-input"]'))[0]!.input('edited in browser')
    render()
    expect(preview.querySelector('#input-result')?.textContent).toBe('edited in browser')
  }
  finally {
    session.close()
    preview.remove()
  }
})
