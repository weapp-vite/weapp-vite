import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { datasetObjectFiles, expectedObjectDataset } from '../test/helpers/datasetObjects'

it('updates same-key row datasets in browser consumers while keeping prior events and string attributes', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(datasetObjectFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    return new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    let initialEvent: unknown
    for (const [value, count] of [['pending', 1], ['complete', 2]] as const) {
      if (value === 'complete') {
        page.replace()
      }
      const native = (await render().$('#row'))!
      const element = preview.querySelector('#row')!
      expect(element.getAttribute('data-item')).toBe('[object Object]')
      expect(element.getAttribute('data-item-name')).toBe(value)
      expect(element.getAttribute('data-index')).toBe('0')
      expect(element.getAttribute('data-enabled')).toBe('false')
      expect(element.getAttribute('data-literal')).toBe('0')
      expect(element.getAttribute('data-mixed')).toBe('row-0')
      await native.tap()
      expect(page.data.event).toEqual(expectedObjectDataset(value, count))
      if (value === 'pending') {
        initialEvent = page.data.event
      }
      else {
        expect(initialEvent).toEqual(expectedObjectDataset())
      }
      page.query()
      expect(page.data.selector).toEqual(expectedObjectDataset(value, count))
      page.observe()
      expect(page.data.observer).toEqual(expectedObjectDataset(value, count))
      const component = (await render().$('dataset-probe'))!
      await (await component.$('#emit'))!.tap()
      expect(page.data.componentEvent).toEqual(expectedObjectDataset(value, count, 'component-0'))
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
