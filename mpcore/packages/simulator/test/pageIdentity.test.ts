import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('testing page identity', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('preserves identity across fresh handles and replaces it on same-route reLaunch', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const session = await launch({ projectPath })
    try {
      const first = (await session.currentPage())!
      const refreshed = (await session.currentPage())!
      expect(refreshed).not.toBe(first)
      expect(refreshed.pageId).toBe(first.pageId)
      expect(Reflect.set(first, 'pageId', -1)).toBe(false)
      await first.setData({ '__e2eData.greeting': 'Changed' })
      expect(await (await refreshed.$('#greeting-button'))?.text()).toBe('Changed')
      const replacement = await session.reLaunch(`/${first.path}`)
      expect(replacement.path).toBe(first.path)
      expect(replacement.pageId).not.toBe(first.pageId)
      expect((await session.currentPage())?.pageId).toBe(replacement.pageId)
      expect(await (await replacement.$('#greeting-button'))?.text()).toBe('Hello')
    }
    finally {
      await session.close()
    }
  })
})
