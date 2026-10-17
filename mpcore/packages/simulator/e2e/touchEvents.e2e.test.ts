import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { touchEventFiles, touchPoint } from '../test/helpers/touchEvents'

it('delivers touch payloads through the shared browser event chain and updates rendered handlers', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(touchEventFiles) })
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
    const page = session.reLaunch('/pages/index/index')
    const node = (await render().$('#touch'))!
    await node.touchstart({ touches: [touchPoint], changedTouches: [touchPoint] })
    await node.touchmove({ touches: [touchPoint], changeTouches: [touchPoint] })
    await node.touchend({ touches: [], changedTouches: [touchPoint] })
    expect(page.data.events).toMatchObject([
      { type: 'touchstart', touches: [touchPoint], changedTouches: [touchPoint], target: { id: 'touch', dataset: { kind: 'page' } } },
      { type: 'touchmove', touches: [touchPoint], changedTouches: [touchPoint] },
      { type: 'touchend', touches: [], changedTouches: [touchPoint] },
    ])
    render()
    expect(preview.querySelector('#last-type')?.textContent).toBe('touchend')
    await (await render().$('touch-card'))!.dispatchEvent({ eventName: 'touchend', $: '#component-touch', touches: [], changedTouches: [touchPoint] })
    render()
    expect(preview.querySelector('#component-touch')?.textContent).toBe('touchend')
    expect(session.selectComponent('#card').data.events).toMatchObject([
      { type: 'touchend', changedTouches: [touchPoint], target: { id: 'component-touch', dataset: { kind: 'component' } } },
    ])
  }
  finally {
    session.close()
    preview.remove()
  }
})
