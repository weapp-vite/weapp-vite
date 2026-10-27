import type { PropsProjectionFixture } from '../test/helpers/propsProjection'
// @ts-expect-error Node 侧编译真实 Issue fixture，浏览器复用相同脚本、模板及配置。
import fixture from 'virtual:props-projection-fixture'
import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'

it('renders direct navigation bindings and keeps projected local state independent from parent props', async () => {
  const { files } = fixture as PropsProjectionFixture
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    return new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      dispatchNativeEvent: (node, eventName, event, onHandlerResult) => session.dispatchNativeNodeEvent(node, eventName, event, onHandlerResult),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const checkNavigation = async (current: number, max: number) => {
      await vi.waitFor(() => {
        render()
        expect(preview.querySelector('#nav-position')?.textContent).toBe(`${current}/${max}`)
        expect(preview.querySelector('#next')?.getAttribute('disabled')).toBe(String(current >= max))
        expect(preview.querySelector('#previous')?.getAttribute('disabled')).toBe(String(current <= 1))
      })
    }
    const checkCanvas = async (local: string, parent: string) => {
      await vi.waitFor(() => {
        render()
        for (const selector of ['#conflict-probe', '#mutable-probe']) {
          expect(preview.querySelector(`${selector} #local-canvas`)?.textContent).toBe(local)
          expect(preview.querySelector(`${selector} #parent-canvas`)?.textContent).toBe(parent)
        }
      })
    }
    const tap = async (...selectors: string[]) => {
      let target = render()
      for (const selector of selectors) {
        const node = await target.$(selector)
        expect(node, `Expected a node matching ${selector} in the current component scope`).not.toBeNull()
        target = node!
      }
      await target.tap()
    }

    await checkNavigation(1, 3)
    await checkCanvas('local-canvas', 'parent-canvas')
    await tap('#nav-probe', '#next')
    await checkNavigation(2, 3)
    await tap('#nav-probe', '#previous')
    await checkNavigation(1, 3)
    await tap('#nav-probe', '#next')
    await checkNavigation(2, 3)
    await tap('#nav-probe', '#next')
    await checkNavigation(3, 3)
    await tap('#extend-max')
    await checkNavigation(3, 4)
    await tap('#nav-probe', '#next')
    await checkNavigation(4, 4)

    await tap('#update-parent-canvas')
    await checkCanvas('local-canvas', 'updated-parent')
    await tap('#conflict-probe', '#change-local')
    await tap('#mutable-probe', '#change-local')
    await checkCanvas('changed-local', 'updated-parent')

    const reopened = session.reLaunch('/pages/index/index')
    expect(reopened).not.toBe(page)
    await checkNavigation(1, 3)
    await checkCanvas('local-canvas', 'parent-canvas')
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
