import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { nativeRefresherFiles } from '../test/helpers/nativeRefresher'

it('commits native refresh state through the browser touch bridge without replaying query renders', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(nativeRefresherFiles),
    onRender: () => { preview.innerHTML = session.renderCurrentPage().wxml },
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    await new Promise<void>(resolve => page.setData({}, resolve))
    const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      dispatchNativeEvent: (node, name, event) => session.dispatchNativeNodeEvent(node, name, event),
      createPageHandle: () => ({ data: async () => page.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
    const node = (await root.$('#content'))!
    const first = { identifier: 1, clientX: 20, clientY: 10 }
    const pulled = { identifier: 1, clientX: 20, clientY: 120 }
    await node.touchstart({ touches: [first], changedTouches: [first] })
    await node.touchmove({ touches: [pulled], changedTouches: [pulled] })
    await node.touchend({ touches: [], changedTouches: [pulled] })
    const types = () => (JSON.parse(preview.querySelector('#trace')?.textContent || '[]') as Array<{ type: string }>).map(event => event.type)
    await vi.waitFor(() => expect(types()).toEqual(['refresherpulling', 'refresherrefresh']))
    expect(page.data.state.triggered).toBe(false)
    page.measure()
    await new Promise<void>(resolve => page.setData({ 'state.sibling': 1 }, resolve))
    expect(types()).toHaveLength(2)
    await new Promise<void>(resolve => page.setData({ 'state.triggered': false }, resolve))
    await vi.waitFor(() => expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore']))
    session.renderCurrentPage()
    page.measure()
    expect(types()).toHaveLength(3)

    const pull = async (selector: string) => {
      const target = (await root.$(selector))!
      await target.touchstart({ touches: [first], changedTouches: [first] })
      await target.touchmove({ touches: [pulled], changedTouches: [pulled] })
      await target.touchend({ touches: [], changedTouches: [pulled] })
    }
    await pull('#flag-0')
    await vi.waitFor(() => expect(types().slice(3)).toEqual(['refresherpulling', 'refresherrefresh']))
    await new Promise<void>(resolve => page.setData({ 'flags[1]': false, 'flag': false }, resolve))
    expect(types()).toHaveLength(5)
    await new Promise<void>(resolve => page.setData({ 'flags[0]': false }, resolve))
    await vi.waitFor(() => expect(types().slice(3)).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore']))

    await pull('#scalar')
    await vi.waitFor(() => expect(types().slice(6)).toEqual(['refresherpulling', 'refresherrefresh']))
    await new Promise<void>(resolve => page.setData({ 'scalarState.sibling': 1 }, resolve))
    expect(types()).toHaveLength(8)
    await new Promise<void>(resolve => page.setData({ 'scalarState.triggered': false }, resolve))
    await vi.waitFor(() => expect(types().slice(6)).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore']))
  }
  finally {
    session.close()
    preview.remove()
  }
})
