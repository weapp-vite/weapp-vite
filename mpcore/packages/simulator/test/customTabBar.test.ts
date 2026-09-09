import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingPageHandle } from '../src/testing'
import { queryXPathElements } from '../src/view/xpath'
import { cleanupTempDirs } from './helpers'
import { customTabBarFiles } from './helpers/customTabBar'

describe('custom tabbar sibling roots', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createNodeSession() {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-custom-tabbar-'))
    directories.push(projectPath)
    for (const [file, source] of customTabBarFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  for (const provider of ['node', 'browser'] as const) {
    it(`owns a tabbar outside the page layout and retains it with its tab in ${provider}`, () => {
      const session = provider === 'node'
        ? createNodeSession()
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(customTabBarFiles) })
      try {
        const pageA = session.reLaunch('/pages/a/index')
        const tabA = pageA.getTabBar?.()
        expect(tabA?.data).toEqual({ count: 0, ready: 1, layout: 'outside' })
        const tree = session.renderCurrentPage()
        expect(queryXPathElements(tree.root, '//*[contains(@class, "custom-tab-bar")]')).toHaveLength(1)
        expect(queryXPathElements(tree.root, '//*[@id="layout"][descendant::*[contains(@class, "custom-tab-bar")]]')).toHaveLength(0)
        tabA!.increment()
        expect(session.renderCurrentPage().wxml).toContain('tab:1')

        const pageB = session.switchTab('/pages/b/index')
        const tabB = pageB?.getTabBar?.()
        expect(tabB).not.toBe(tabA)
        expect(tabB?.data.count).toBe(0)
        session.switchTab('/pages/a/index')
        expect(pageA.getTabBar?.()).toBe(tabA)
        expect(session.renderCurrentPage().wxml).toContain('tab:1')

        const detail = session.navigateTo('/pages/detail/index')
        expect(detail.getTabBar?.()).toBeNull()
        expect(queryXPathElements(session.renderCurrentPage().root, '//*[contains(@class, "custom-tab-bar")]')).toHaveLength(0)
        session.navigateBack()
        expect(pageA.getTabBar?.()).toBe(tabA)
        expect(session.getApp()?.globalData).toEqual({ attached: 2, detached: 0 })
        session.reLaunch('/pages/detail/index')
        expect(session.getApp()?.globalData).toEqual({ attached: 2, detached: 2 })
      }
      finally {
        session.close()
      }
    })
  }

  it('keeps CSS page-local while XPath handles retain component interactions', async () => {
    const session = createNodeSession()
    try {
      const page = session.reLaunch('/pages/a/index')
      const handle = new HeadlessTestingPageHandle(session.project, page, session)
      expect(await handle.$$('.custom-tab-bar')).toHaveLength(0)
      expect(await handle.$('#layout')).not.toBeNull()
      const [button] = await handle.getElementsByXpath('//*[@id="tab-counter"]')
      expect(await button?.text()).toBe('tab:0')
      await button!.tap()
      const [updated] = await handle.getElementsByXpath('//*[@id="tab-counter"]')
      expect(await updated?.text()).toBe('tab:1')
      await expect(handle.getElementsByXpath('//*[')).rejects.toThrow()
      await expect(handle.getElementsByXpath(' ')).rejects.toThrow('non-empty')
      expect(await handle.getElementsByXpath('//*[@id="missing"]')).toHaveLength(0)
      expect(await handle.getElementsByXpath('//*[@id="tab-counter"]/@id/..')).toHaveLength(1)
      expect(await handle.getElementsByXpath('//*[@id="tab-counter"]/@id/node()')).toHaveLength(0)
    }
    finally {
      session.close()
    }
  })
})
