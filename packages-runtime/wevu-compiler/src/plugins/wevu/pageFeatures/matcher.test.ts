import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createPageEntryMatcher } from './matcher'

describe('createPageEntryMatcher', () => {
  it('matches page files from pages/subPackages/pluginPages and supports markDirty', async () => {
    const loadEntries = vi.fn(async () => ({
      pages: ['/pages/home/index'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['detail/index'],
        },
      ],
      pluginPages: ['plugin/pages/p/index.ts'],
    }))

    const matcher = createPageEntryMatcher({
      srcRoot: '/project/src',
      loadEntries,
    })

    expect(await matcher.isPageFile('/project/src/pages/home/index.vue')).toBe(true)
    expect(await matcher.isPageFile('/project/src/packageA/detail/index.js')).toBe(true)
    expect(await matcher.isPageFile('/project/src/plugin/pages/p/index.wxml')).toBe(true)
    expect(await matcher.isPageFile('/project/src/pages/unknown/index.vue')).toBe(false)
    expect(loadEntries).toHaveBeenCalledTimes(1)

    matcher.markDirty()
    await matcher.isPageFile('/project/src/pages/home/index.vue')
    expect(loadEntries).toHaveBeenCalledTimes(2)
  })

  it('warns when loading entries fails', async () => {
    const warn = vi.fn()
    const matcher = createPageEntryMatcher({
      srcRoot: '/project/src',
      loadEntries: async () => {
        throw new Error('boom')
      },
      warn,
    })

    expect(await matcher.isPageFile(path.resolve('/project/src/pages/home/index.vue'))).toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})
