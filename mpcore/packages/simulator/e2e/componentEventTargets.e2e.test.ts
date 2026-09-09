import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { componentEventTargetFiles } from '../test/helpers/componentEventTargets'

it('retargets forwarded button events to the component host across a rendered dialog', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentEventTargetFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    return new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
  }
  try {
    session.reLaunch('/pages/index/index')
    for (const kind of ['cancel', 'confirm']) {
      const dialog = (await render().$('dialog-box'))!
      const host = (await dialog.$(`#${kind}-host`))!
      await (await host.$(`#${kind}-native`))!.tap()
      const root = render()
      expect(preview.querySelector('#result')?.textContent).toBe(`${kind}/${kind}-host/${kind}-native`)
      expect(await (await root.$('#result'))?.text()).toBe(`${kind}/${kind}-host/${kind}-native`)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
