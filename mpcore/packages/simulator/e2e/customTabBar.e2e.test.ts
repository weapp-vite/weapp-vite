import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { customTabBarFiles } from '../test/helpers/customTabBar'

describe('custom tabbar browser DOM', () => {
  it('queries the sibling tabbar by XPath and distinguishes missing nodes from invalid queries', async () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(customTabBarFiles) })
    const preview = document.createElement('div')
    document.body.append(preview)
    try {
      session.reLaunch('/pages/a/index')
      const tree = session.renderCurrentPage()
      preview.innerHTML = tree.wxml
      const root = new HeadlessTestingNodeHandle(tree.root)
      const matches = await root.getElementsByXpath('//*[@id="tab-counter"]')

      expect(matches).toHaveLength(1)
      expect(await matches[0]!.text()).toBe('tab:0')
      expect(preview.querySelector('#tab-counter')?.textContent).toBe('tab:0')
      expect(await root.getElementsByXpath('//*[@id="layout"]//*[@id="tab-counter"]')).toHaveLength(0)
      expect(await root.getElementsByXpath('//*[@id="missing"]')).toHaveLength(0)
      await expect(root.getElementsByXpath('//*[')).rejects.toThrow()
    }
    finally {
      session.close()
      preview.remove()
    }
  })

  it('renders the tabbar as a sibling and restores the owning tab state', () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(customTabBarFiles) })
    const preview = document.createElement('div')
    document.body.append(preview)
    const render = () => {
      preview.innerHTML = session.renderCurrentPage().wxml
    }
    try {
      const page = session.reLaunch('/pages/a/index')
      render()
      expect(preview.querySelector('#layout .custom-tab-bar')).toBeNull()
      expect(preview.querySelector('.custom-tab-bar #tab-counter')?.textContent).toBe('tab:0')
      page.getTabBar?.()?.increment()
      render()
      expect(preview.querySelector('#tab-counter')?.textContent).toBe('tab:1')
      expect(preview.querySelector('#tab-ready')?.textContent).toBe('ready:1 outside')
      session.navigateTo('/pages/detail/index')
      render()
      expect(preview.querySelector('.custom-tab-bar')).toBeNull()
      session.navigateBack()
      render()
      expect(preview.querySelector('#tab-counter')?.textContent).toBe('tab:1')
      session.triggerResize({ size: { windowWidth: 375 } })
      expect(session.getStorageSnapshot().customTabBarPageLifetimes ?? []).toEqual([])
    }
    finally {
      session.close()
      preview.remove()
    }
  })
})
