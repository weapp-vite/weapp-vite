import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('testing evaluator runtime globals', () => {
  const roots: string[] = []
  afterEach(() => cleanupTempDirs(roots))

  it('shares application globals across evaluations and renders mutations through the same host', async () => {
    const projectPath = createBaseFixture()
    roots.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), 'globalThis.applicationState = { count: 2 }; App({})')
    const session = await launch({ projectPath })
    try {
      await expect(session.evaluate('() => globalThis.applicationState.count')).resolves.toBe(2)
      await session.evaluate('(value) => { globalThis.applicationState.count += value; getCurrentPages()[0].setData({ "__e2eData.greeting": "Count: " + globalThis.applicationState.count }); }', 3)
      await expect(session.evaluate('() => globalThis.applicationState.count')).resolves.toBe(5)
      const page = await session.currentPage()
      expect(await (await page!.$('#greeting-button'))!.text()).toBe('Count: 5')
    }
    finally {
      await session.close()
    }
  })

  it('keeps two project pages independently queryable after both sessions are ready', async () => {
    const firstProject = createBaseFixture()
    const secondProject = createBaseFixture()
    roots.push(firstProject, secondProject)
    const first = await launch({ projectPath: firstProject })
    const second = await launch({ projectPath: secondProject })
    try {
      const firstPage = await first.waitForCurrentPage('/pages/index/index')
      const secondPage = await second.waitForCurrentPage('/pages/index/index')
      expect(await (await firstPage.$('#greeting-button'))!.text()).toBe('Hello')
      expect(await (await secondPage.$('#greeting-button'))!.text()).toBe('Hello')
      await first.evaluate('() => getCurrentPages()[0].setData({ "__e2eData.greeting": "First project" })')
      expect(await (await firstPage.$('#greeting-button'))!.text()).toBe('First project')
      expect(await (await secondPage.$('#greeting-button'))!.text()).toBe('Hello')
      await second.close()
      expect((await first.currentPage())?.pageId).toBe(firstPage.pageId)
      expect(await (await firstPage.$('#greeting-button'))!.text()).toBe('First project')
    }
    finally {
      await first.close()
      await second.close()
    }
  })

  it('isolates application state between sessions and cancels evaluator timers on close', async () => {
    const projectPath = createBaseFixture()
    roots.push(projectPath)
    const first = await launch({ projectPath })
    const second = await launch({ projectPath })
    try {
      await first.evaluate('() => { globalThis.onlyFirst = true; setTimeout(() => wx.setStorageSync("late", true), 40); }')
      await expect(second.evaluate('() => typeof globalThis.onlyFirst')).resolves.toBe('undefined')
      const readLate = await first.evaluate('() => () => wx.getStorageSync("late")')
      await first.close()
      await new Promise(resolve => setTimeout(resolve, 70))
      expect((readLate as () => unknown)()).not.toBe(true)
      await expect(first.evaluate('() => 1')).rejects.toThrow()
    }
    finally {
      await first.close()
      await second.close()
    }
  })
})
