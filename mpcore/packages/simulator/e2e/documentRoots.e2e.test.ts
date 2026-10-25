import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { documentRootFiles } from '../test/helpers/documentRoots'

describe('complete page and tabbar document roots in the browser', () => {
  it('reads all sibling roots before and after a nested component update', async () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(documentRootFiles) })
    const preview = document.createElement('div')
    document.body.append(preview)
    try {
      const page = session.reLaunch('/pages/home/index')
      const readDocument = async () => {
        const handle = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
        const roots = await handle.getElementsByXpath('/*')
        expect(roots).toHaveLength(2)
        const fragments: string[] = []
        for (const root of roots) {
          fragments.push(await root.wxml())
        }
        return fragments.join('')
      }
      preview.innerHTML = await readDocument()
      expect(preview.querySelector('#header')?.textContent).toBe('first title')
      expect(preview.querySelector('#price')?.textContent).toBe('price:10')
      expect(preview.querySelector('#footer')?.textContent).toBe('footer')
      expect(preview.querySelector('#independent-tabbar')?.textContent).toBe('Home / Profile')
      expect(preview.querySelector('page #independent-tabbar')).toBeNull()

      page.setData({ title: 'updated title', price: 20 })
      preview.innerHTML = await readDocument()
      expect(preview.querySelector('#header')?.textContent).toBe('updated title')
      expect(preview.querySelector('#price')?.textContent).toBe('price:20')
      expect(preview.querySelector('#footer')?.textContent).toBe('footer')
      expect(preview.querySelector('#independent-tabbar')?.textContent).toBe('Home / Profile')
    }
    finally {
      session.close()
      preview.remove()
    }
  })
})
