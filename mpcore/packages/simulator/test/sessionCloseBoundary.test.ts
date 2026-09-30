import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { createComponentInstanceApiFiles } from './helpers/componentInstanceApis'

describe('HeadlessSession close and navigation failure boundaries', () => {
  const directories: string[] = []

  afterEach(() => {
    cleanupTempDirs(directories)
    vi.useRealTimers()
  })

  function createFixture() {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const files = new Map(createComponentInstanceApiFiles())
    files.set('pages/index/index.js', `Page({
      data: { showChild: true, failUnload: false, draft: 'initial' },
      onUnload() {
        lifecycle.push('page:unload')
        if (this.data.failUnload) throw unloadFailure
      }
    })`)
    files.set('pages/empty/index.js', `Page({
      onLoad() { targetLoaded() },
      onUnload() { lifecycle.push('bottom:unload') }
    })`)
    for (const label of ['parent', 'child'] as const) {
      const key = label === 'parent' ? './child' : './parent'
      const type = label === 'parent' ? 'descendant' : 'ancestor'
      files.set(`components/${label}.js`, `Component({
        data: { label: '${label}', draft: 'initial', failDetach: false, released: false },
        relations: { '${key}': { type: '${type}' } },
        detached() {
          this.setData({ released: true })
          lifecycle.push('${label}:detached')
          if (this.data.failDetach) throw detachFailures['${label}']
        }
      })`)
    }
    for (const [relativePath, source] of files) {
      const target = path.join(projectPath, 'dist', relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return projectPath
  }

  it.each(['reLaunch', 'redirectTo', 'navigateBack'] as const)('keeps the page stack and rendered component state when %s cannot unload the current page', (method) => {
    const lifecycle: string[] = []
    const unloadFailure = new Error('current page unload failed')
    let targetLoaded = false
    const session = createHeadlessSession({
      projectPath: createFixture(),
      globals: {
        lifecycle,
        unloadFailure,
        targetLoaded() { targetLoaded = true },
      },
    })
    try {
      const bottom = session.reLaunch('/pages/empty/index')
      bottom.setData({ draft: 'unsaved bottom page' })
      const page = session.navigateTo('/pages/index/index')
      session.renderCurrentPage()
      const parent = page.selectComponent!('#parent')
      const child = parent.getRelationNodes('./child')[0]
      expect(child.getRelationNodes('./parent')).toEqual([parent])
      parent.setData({ draft: 'unsaved parent' })
      child.setData({ draft: 'unsaved child' })
      page.setData({ draft: 'unsaved current page', failUnload: true })
      targetLoaded = false

      let failure: unknown
      try {
        if (method === 'navigateBack') {
          session.navigateBack()
        }
        else {
          session[method]('/pages/empty/index')
        }
      }
      catch (error) {
        failure = error
      }

      expect(failure).toBe(unloadFailure)
      expect(session.isClosed).toBe(false)
      const pages = session.getCurrentPages()
      expect(pages).toHaveLength(2)
      expect(pages[0]).toBe(bottom)
      expect(pages[1]).toBe(page)
      expect(bottom.data.draft).toBe('unsaved bottom page')
      expect(page.data.draft).toBe('unsaved current page')
      expect(lifecycle).toEqual(['page:unload'])
      expect(parent.data.released).toBe(false)
      expect(child.data.released).toBe(false)
      expect(targetLoaded).toBe(false)

      session.renderCurrentPage()
      expect(page.selectComponent!('#parent')).toBe(parent)
      expect(parent.getRelationNodes('./child')).toEqual([child])
      expect(child.getRelationNodes('./parent')).toEqual([parent])
      expect(parent.data.draft).toBe('unsaved parent')
      expect(child.data.draft).toBe('unsaved child')
      expect(lifecycle).toEqual(['page:unload'])
    }
    finally {
      for (const page of session.getCurrentPages()) {
        page.setData({ failUnload: false })
      }
      session.close()
    }
  })

  it.each(['before the microtask', 'before the host timer'] as const)('detaches every component and unlinks relations when close fails %s', (window) => {
    vi.useFakeTimers({ toFake: ['queueMicrotask', 'setTimeout', 'clearTimeout'] })
    const lifecycle: string[] = []
    const navigationCallbacks: string[] = []
    const detachFailures = {
      parent: new Error('parent detached failed'),
      child: new Error('child detached failed'),
    }
    let targetLoaded = false
    const session = createHeadlessSession({
      projectPath: createFixture(),
      globals: {
        lifecycle,
        detachFailures,
        targetLoaded() { targetLoaded = true },
      },
    })
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      const parent = page.selectComponent!('#parent')
      const child = parent.getRelationNodes('./child')[0]
      expect(child.getRelationNodes('./parent')).toEqual([parent])
      expect(parent.getRelationNodes('./child')).toEqual([child])
      parent.setData({ failDetach: true })
      child.setData({ failDetach: true })
      vi.runAllTicks()
      vi.runAllTimers()
      session.callWxMethod('navigateTo', {
        url: '/pages/empty/index',
        success() { navigationCallbacks.push('success') },
        fail() { navigationCallbacks.push('fail') },
        complete() { navigationCallbacks.push('complete') },
      })
      if (window === 'before the host timer') {
        vi.runAllTicks()
      }
      expect(session.getCurrentPages().at(-1)).toBe(page)
      expect(targetLoaded).toBe(false)

      let failure: unknown
      try {
        session.close()
      }
      catch (error) {
        failure = error
      }

      expect(failure).toBe(detachFailures.parent)
      expect(session.isClosed).toBe(true)
      expect(lifecycle).toEqual(['page:unload', 'parent:detached', 'child:detached'])
      expect(parent.data.released).toBe(true)
      expect(child.data.released).toBe(true)
      expect(parent.getRelationNodes('./child')).toEqual([])
      expect(child.getRelationNodes('./parent')).toEqual([])
      expect(() => session.getCurrentPages()).toThrow(/closed/i)
      vi.runAllTicks()
      vi.runAllTimers()
      expect(targetLoaded).toBe(false)
      expect(navigationCallbacks).toEqual([])

      session.close()
      vi.runAllTicks()
      vi.runAllTimers()
      expect(lifecycle).toEqual(['page:unload', 'parent:detached', 'child:detached'])
      expect(parent.getRelationNodes('./child')).toEqual([])
      expect(child.getRelationNodes('./parent')).toEqual([])
      expect(targetLoaded).toBe(false)
      expect(navigationCallbacks).toEqual([])
    }
    finally {
      session.close()
    }
  })
})
