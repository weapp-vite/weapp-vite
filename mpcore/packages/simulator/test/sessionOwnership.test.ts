import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { cleanupTempDirs, createNavigationFixture } from './helpers'

describe('HeadlessSession project ownership', () => {
  const directories: string[] = []

  afterEach(() => cleanupTempDirs(directories))

  it('keeps another project navigable after repeated close of the first session', () => {
    const firstProject = createNavigationFixture()
    const secondProject = createNavigationFixture()
    directories.push(firstProject, secondProject)
    const first = createHeadlessSession({ projectPath: firstProject })
    const second = createHeadlessSession({ projectPath: secondProject })
    try {
      const firstHome = first.reLaunch('/pages/home/index?owner=first')
      const secondHome = second.reLaunch('/pages/home/index?owner=second')
      expect(firstHome.data.logs).toContain('home:onLoad:{"owner":"first"}')
      expect(secondHome.data.logs).toContain('home:onLoad:{"owner":"second"}')
      expect(secondHome.data.logs).not.toContain('home:onLoad:{"owner":"first"}')
      first.reLaunch('/pages/detail/index')
      second.reLaunch('/pages/detail/index')

      first.close()
      first.close()
      expect(first.isClosed).toBe(true)
      expect(second.isClosed).toBe(false)
      const current = second.reLaunch('/pages/home/index?owner=survivor')
      expect(second.getCurrentPages()).toEqual([current])
      expect(current.route).toBe('pages/home/index')
      expect(current.data.logs).toContain('home:onLoad:{"owner":"survivor"}')
      expect(second.renderCurrentPage()).toBeTruthy()
    }
    finally {
      first.close()
      second.close()
    }
  })

  it('supports both automator disposal methods on the existing testing adapter', async () => {
    const projectPath = createNavigationFixture()
    directories.push(projectPath)
    const first = await launch({ projectPath })
    const second = await launch({ projectPath })
    let closed = 0
    first.on('close', () => closed++)
    try {
      expect(first.disconnect()).toBeUndefined()
      first.disconnect()
      await first.close()
      expect(closed).toBe(1)
      await expect(first.currentPage()).rejects.toThrow(/closed/i)
      const page = await second.reLaunch('/pages/detail/index')
      expect(page.path).toBe('pages/detail/index')
      await second.close()
      expect(second.disconnect()).toBeUndefined()
    }
    finally {
      await first.close()
      await second.close()
    }
  })
})
