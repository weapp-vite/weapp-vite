import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { layoutStatusSelectorFiles } from '../test/helpers/layoutStatusSelectors'

it('keeps the updated hero status distinct from three cards with the same class', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(layoutStatusSelectorFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    for (const [index, status] of ['default', 'admin', 'none', 'default'].entries()) {
      if (index > 0) {
        page.setStatus(status)
      }
      const tree = session.renderCurrentPage()
      preview.innerHTML = tree.wxml
      const root = new HeadlessTestingNodeHandle(tree.root)
      expect(await root.$$('.leading-7')).toHaveLength(4)
      const nodes = await root.$$('.bg-linear-to-br .leading-7')
      expect(nodes).toHaveLength(1)
      expect(await nodes[0]!.text()).toBe(`当前状态：${status}`)
      expect(preview.querySelectorAll('.leading-7')).toHaveLength(4)
      const rendered = preview.querySelectorAll('.bg-linear-to-br .leading-7')
      expect(rendered).toHaveLength(1)
      expect(rendered[0]!.textContent).toBe(`当前状态：${status}`)
      expect(preview.querySelector('.cards .leading-7')?.textContent).toBe('默认布局说明')
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
