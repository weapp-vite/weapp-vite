import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingSessionHandle } from '../src/testing'
import { cleanupTempDirs } from './helpers'
import { pluginProtocolFiles } from './helpers/pluginProtocol'

describe('plugin testing protocol paths', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('exposes the DevTools path alongside rendered plugin content without changing the internal route', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-plugin-protocol-'))
    directories.push(projectPath)
    for (const [file, source] of pluginProtocolFiles()) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const runtime = createHeadlessSession({ projectPath })
    const session = new HeadlessTestingSessionHandle(runtime.project, runtime)
    try {
      const host = await session.reLaunch('/pages/index/index')
      expect(host.path).toBe('pages/index/index')
      expect(await (await host.$('#host-title'))?.text()).toBe('Plugin host')
      const [hostMeter] = await host.getElementsByXpath('//*[@id="meter-value"]')
      expect(await hostMeter?.text()).toBe('78%')

      const page = await session.navigateTo('plugin://hello/hello-page?source=host')
      expect(page.path).toBe('__plugin__/wxpluginprovider/pages/hello/index')
      expect(page.query).toEqual({ source: 'host' })
      expect(runtime.getCurrentPages().at(-1)?.route).toBe('plugin-private://wxpluginprovider/pages/hello/index')
      expect((await session.currentPage())?.path).toBe('__plugin__/wxpluginprovider/pages/hello/index')
      expect((await session.getCurrentPages()).map(item => item.path)).toEqual(['pages/index/index', '__plugin__/wxpluginprovider/pages/hello/index'])
      expect((await session.waitForCurrentPage('/__plugin__/wxpluginprovider/pages/hello/index', { timeout: 20 })).pageId).toBe(page.pageId)
      expect((await session.waitForCurrentPage('plugin-private://wxpluginprovider/pages/hello/index', { timeout: 20 })).pageId).toBe(page.pageId)
      await expect(session.waitForCurrentPage('__plugin__/different-provider/pages/hello/index', { timeout: 0 })).rejects.toThrow('Timed out waiting')

      const [title] = await page.getElementsByXpath('//*[@id="plugin-title"]')
      expect(await title?.text()).toBe('Plugin page')
      const cards = await page.getElementsByXpath('//*[@class="plugin-card"]')
      expect(cards).toHaveLength(4)
      expect(await Promise.all(cards.map(card => card.text()))).toEqual(['Vue SFC', 'Native components', 'Styles', 'Navigation'])
      const [meter] = await page.getElementsByXpath('//*[@id="meter-value"]')
      expect(await meter?.text()).toBe('94%')
      const snapshot = await page.snapshot()
      expect(snapshot.path).toBe('__plugin__/wxpluginprovider/pages/hello/index')
      expect(snapshot.wxml).toContain('Plugin page')

      const [increment] = await page.getElementsByXpath('//*[@id="increment"]')
      expect(increment).toBeDefined()
      await increment!.tap()
      const [updated] = await page.getElementsByXpath('//*[@id="meter-value"]')
      expect(await updated?.text()).toBe('100%')
      expect(runtime.getCurrentPages().at(-1)?.route).toBe('plugin-private://wxpluginprovider/pages/hello/index')
      expect((await session.navigateBack())?.path).toBe('pages/index/index')
      expect((await session.currentPage())?.pageId).toBe(host.pageId)
    }
    finally {
      await session.close()
    }
  })
})
