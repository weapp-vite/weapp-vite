import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { datasetValueFiles } from '../test/helpers/datasetValues'

it('keeps numeric dataset values typed while rendering string attributes in the browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(datasetValueFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    return new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const native = (await render().$('#native-0'))!

    expect(preview.querySelector('[data-index="0"]')?.getAttribute('data-index')).toBe('0')
    expect(preview.querySelector('#native-0')?.getAttribute('data-literal-index')).toBe('0')
    expect(await native.dataset()).toEqual({ index: 0, literalIndex: '0' })

    await native.tap()
    expect(page.data.nativeCapture).toEqual({
      currentTarget: { index: 0, literalIndex: '0' },
      target: { index: 0, literalIndex: '0' },
    })

    page.readSelectorDataset()
    expect(page.data.selectorDataset).toEqual({ index: 0, literalIndex: '0' })

    page.playVideo()
    expect(page.data.videoCapture).toEqual({ index: 2, literalIndex: '0' })
  }
  finally {
    session.close()
    preview.remove()
  }
})
