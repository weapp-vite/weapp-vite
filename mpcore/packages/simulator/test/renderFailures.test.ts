import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { renderFailureFiles } from './helpers/renderFailures'

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe.each(['node', 'browser'] as const)('%s render failure boundaries', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(renderFailureFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-render-failure-'))
    directories.push(projectPath)
    for (const [file, source] of renderFailureFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('records detached errors, releases both siblings and relations, and settles callbacks without retrying', async () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      const state = session.getApp()!.globalData
      const parent = session.selectComponent('#parent')!
      const first = session.selectComponent('#first')!
      expect(parent.getRelationNodes('../child/index')).toHaveLength(2)
      await flushMicrotasks()
      const render = vi.spyOn(session, 'renderCurrentPage')
      let callbackDiagnostics: ReturnType<typeof session.getDiagnostics> = []
      const callback = vi.fn(() => {
        callbackDiagnostics = session.getDiagnostics()
      })
      page.setData({ visible: false }, callback)
      await flushMicrotasks()
      expect(callback).toHaveBeenCalledOnce()
      expect(callbackDiagnostics).toEqual([
        expect.objectContaining({ level: 'exception', args: [expect.objectContaining({ message: 'detached hook failed' })] }),
      ])
      expect(state.detached).toEqual(['first', 'second'])
      expect(state.callbacks).toEqual(['first', 'second'])
      expect(render).toHaveBeenCalledOnce()
      expect(parent.getRelationNodes('../child/index')).toEqual([])
      expect(first.getRelationNodes('../parent/index')).toEqual([])
      expect(session.getScopeIdForComponent(first)).toBeNull()
      expect(session.selectComponent('#first')).toBeNull()
      expect(session.selectComponent('#second')).toBeNull()
      expect(state.detached).toEqual(['first', 'second'])
      const next = vi.fn()
      page.setData({ count: 1 }, next)
      await flushMicrotasks()
      expect(next).toHaveBeenCalledOnce()
      expect(session.getDiagnostics()).toHaveLength(1)
    }
    finally {
      session.getApp()!.globalData.throwOnDetach = false
      session.close()
    }
  })

  it('records callback errors and still completes the rest of the same batch in order', async () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      await flushMicrotasks()
      const failure = new Error('setData callback failed')
      const order: string[] = []
      page.setData({ count: 1 }, () => {
        order.push('first')
        throw failure
      })
      page.setData({ count: 2 }, () => order.push('second'))
      await flushMicrotasks()
      expect(order).toEqual(['first', 'second'])
      expect(session.getDiagnostics()).toEqual([
        expect.objectContaining({ level: 'exception', args: [failure] }),
      ])
    }
    finally {
      session.getApp()!.globalData.throwOnDetach = false
      session.close()
    }
  })
})

it('settles browser callbacks after a failed async host commit and accepts a later explicit update', async () => {
  const failure = new Error('host commit failed')
  let rejectCommit = false
  const onRender = vi.fn(() => rejectCommit ? Promise.reject(failure) : Promise.resolve())
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(renderFailureFiles), onRender })
  try {
    const page = session.reLaunch('/pages/index/index')
    await flushMicrotasks()
    rejectCommit = true
    const before = onRender.mock.calls.length
    const callback = vi.fn()
    page.setData({ count: 1 }, callback)
    await flushMicrotasks()
    expect(callback).toHaveBeenCalledOnce()
    expect(onRender).toHaveBeenCalledTimes(before + 1)
    expect(session.getDiagnostics()).toEqual([
      expect.objectContaining({ level: 'exception', args: [failure] }),
    ])
    rejectCommit = false
    const next = vi.fn()
    page.setData({ count: 2 }, next)
    await flushMicrotasks()
    expect(next).toHaveBeenCalledOnce()
    expect(session.getDiagnostics()).toHaveLength(1)
  }
  finally {
    session.getApp()!.globalData.throwOnDetach = false
    session.close()
  }
})
