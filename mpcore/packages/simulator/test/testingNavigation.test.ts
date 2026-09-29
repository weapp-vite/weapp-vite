import type { HeadlessSession } from '../src/runtime'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeadlessTestingSessionHandle, launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture, createNavigationFixture } from './helpers'

describe('testing navigation diagnostics', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['reLaunch', 'navigateTo', 'redirectTo', 'switchTab'] as const)('rejects %s failures even when the old page remains active', async (method) => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const miniProgram = await launch({ projectPath })
    try {
      const initial = await miniProgram.currentPage()
      expect(initial?.path).toBe('pages/index/index')
      await expect(miniProgram[method]('/pages/missing/index')).rejects.toThrow('Unknown route for headless runtime navigation: /pages/missing/index')
      expect((await miniProgram.currentPage())?.path).toBe(initial?.path)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('preserves the original page module exception after reLaunch empties the stack', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.json'), JSON.stringify({ pages: ['pages/index/index', 'pages/broken/index'] }))
    fs.mkdirSync(path.join(projectPath, 'dist/pages/broken'), { recursive: true })
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.js'), 'throw new Error("Missing component dependency: dialog-content")')
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.json'), '{}')
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.wxml'), '<view>broken page</view>')
    const miniProgram = await launch({ projectPath })
    try {
      await expect(miniProgram.reLaunch('/pages/broken/index')).rejects.toMatchObject({
        message: expect.stringContaining('Missing component dependency: dialog-content'),
        cause: { message: 'Missing component dependency: dialog-content' },
      })
      expect(await miniProgram.currentPage()).toBeNull()
    }
    finally {
      await miniProgram.close()
    }
  })

  it('retains the standard errMsg object from a failing navigation callback', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const miniProgram = await launch({ projectPath })
    try {
      await miniProgram.evaluate(() => {
        const runtime = globalThis as typeof globalThis & { wx: { navigateBack: (options: { fail: (error: { errMsg: string }) => void }) => void } }
        runtime.wx.navigateBack = options => options.fail({ errMsg: 'navigateBack:fail denied by guard' })
      })
      await expect(miniProgram.navigateBack()).rejects.toMatchObject({
        message: expect.stringContaining('navigateBack:fail denied by guard'),
        cause: { errMsg: 'navigateBack:fail denied by guard' },
      })
    }
    finally {
      await miniProgram.close()
    }
  })

  describe.each(['before the microtask', 'before the host timer'] as const)('closing %s', (window) => {
    it('rejects pending navigation without committing the route', async () => {
      const projectPath = createNavigationFixture()
      directories.push(projectPath)
      let session!: HeadlessSession
      const miniProgram = await launch({
        projectPath,
        configureSession: (created) => { session = created },
      })
      try {
        const committed = vi.fn()
        await miniProgram.navigateTo('/pages/detail/index')
        vi.useFakeTimers({ toFake: ['queueMicrotask', 'setTimeout', 'clearTimeout'] })
        const navigation = miniProgram.navigateTo('/pages/settings/index')
        const rejection = expect(navigation).rejects.toThrow(/closed/i)
        session.callWxMethod('navigateTo', { url: '/pages/settings/index', success: committed })
        if (window === 'before the host timer') {
          vi.runAllTicks()
          expect((await miniProgram.currentPage())?.path).toBe('pages/detail/index')
        }
        await miniProgram.close()
        await rejection
        vi.runAllTicks()
        vi.runAllTimers()
        expect(committed).not.toHaveBeenCalled()
        await expect(miniProgram.currentPage()).rejects.toThrow(/closed/i)
      }
      finally {
        await miniProgram.close()
        vi.useRealTimers()
      }
    })
  })

  it('rejects all concurrent navigation waits and calls made after close', async () => {
    const projectPath = createNavigationFixture()
    directories.push(projectPath)
    const miniProgram = await launch({ projectPath })
    try {
      await miniProgram.navigateTo('/pages/detail/index')

      vi.useFakeTimers({ toFake: ['queueMicrotask', 'setTimeout', 'clearTimeout'] })
      const pending = [
        expect(miniProgram.navigateTo('/pages/settings/index')).rejects.toThrow(/closed/i),
        expect(miniProgram.navigateBack()).rejects.toThrow(/closed/i),
      ]
      await miniProgram.close()
      await Promise.all(pending)
      vi.runAllTicks()
      vi.runAllTimers()
      await expect(miniProgram.navigateTo('/pages/settings/index')).rejects.toThrow(/closed/i)
      await expect(miniProgram.getCurrentPages()).rejects.toThrow(/closed/i)
    }
    finally {
      await miniProgram.close()
      vi.useRealTimers()
    }
  })

  it('rejects navigation in every wrapper when the retained underlying session closes directly', async () => {
    const projectPath = createNavigationFixture()
    directories.push(projectPath)
    let session!: HeadlessSession
    const miniProgram = await launch({
      projectPath,
      configureSession: (created) => { session = created },
    })
    const other = new HeadlessTestingSessionHandle(session.project, session)
    try {
      vi.useFakeTimers({ toFake: ['queueMicrotask', 'setTimeout', 'clearTimeout'] })
      const pending = [
        expect(miniProgram.navigateTo('/pages/detail/index')).rejects.toThrow(/closed/i),
        expect(other.navigateTo('/pages/settings/index')).rejects.toThrow(/closed/i),
      ]
      session.close()
      await Promise.all(pending)
      vi.runAllTicks()
      vi.runAllTimers()
      await expect(other.currentPage()).rejects.toThrow(/closed/i)
    }
    finally {
      await miniProgram.close()
      vi.useRealTimers()
    }
  })

  it('preserves unload failure while closing every wrapper and canceling queued navigation', async () => {
    const projectPath = createNavigationFixture()
    directories.push(projectPath)
    let session!: HeadlessSession
    const miniProgram = await launch({
      projectPath,
      configureSession: (created) => { session = created },
    })
    const unloadError = new Error('page unload failed')
    const listenerError = new Error('close listener failed')
    const homeUnloaded = vi.fn()
    const detailUnloaded = vi.fn(() => {
      throw unloadError
    })
    const committed = vi.fn()
    try {
      session.getCurrentPages()[0]!.onUnload = homeUnloaded
      await miniProgram.navigateTo('/pages/detail/index')
      session.getCurrentPages().at(-1)!.onUnload = detailUnloaded
      session.on('close', () => {
        throw listenerError
      })
      const other = new HeadlessTestingSessionHandle(session.project, session)
      vi.useFakeTimers({ toFake: ['queueMicrotask', 'setTimeout', 'clearTimeout'] })
      const pending = [
        expect(miniProgram.navigateTo('/pages/settings/index')).rejects.toThrow(/closed/i),
        expect(other.navigateTo('/pages/settings/index')).rejects.toThrow(/closed/i),
      ]
      session.callWxMethod('navigateTo', { url: '/pages/settings/index', success: committed })
      vi.runAllTicks()

      await expect(miniProgram.close()).rejects.toBe(unloadError)
      await Promise.all(pending)
      expect(session.isClosed).toBe(true)
      await expect(miniProgram.currentPage()).rejects.toThrow(/closed/i)
      vi.runAllTicks()
      vi.runAllTimers()
      expect(committed).not.toHaveBeenCalled()

      await miniProgram.close()
      expect(homeUnloaded).toHaveBeenCalledTimes(1)
      expect(detailUnloaded).toHaveBeenCalledTimes(1)
    }
    finally {
      await miniProgram.close()
      vi.useRealTimers()
    }
  })
})
