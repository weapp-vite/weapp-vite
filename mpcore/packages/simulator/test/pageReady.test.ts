import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { pageReadyFiles } from './helpers/pageReady'

describe.each(['node', 'browser'] as const)('%s page readiness task boundary', (provider) => {
  const tempDirs: string[] = []
  const sessions: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const session of sessions.splice(0)) {
      session.close()
    }
    cleanupTempDirs(tempDirs)
    vi.useRealTimers()
  })

  function createSession() {
    if (provider === 'browser') {
      const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(pageReadyFiles) })
      sessions.push(session)
      return session
    }
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    for (const [file, source] of pageReadyFiles) {
      const output = path.join(projectPath, 'dist', file)
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, source)
    }
    const session = createHeadlessSession({ projectPath })
    sessions.push(session)
    return session
  }

  it('renders completed load microtasks at ready, after navigation success and complete', async () => {
    const session = createSession()
    const firstPage = session.reLaunch('/pages/destination/index')
    await vi.waitFor(() => expect(firstPage.data.ready).toBe(true))
    firstPage.openIndex()
    const page = session.getCurrentPages().at(-1)!
    expect(page.data.label).toBe('pending')
    expect(session.getApp()?.globalData.events).toEqual(['load', 'show', 'success', 'complete'])
    await vi.waitFor(() => expect(page.data.label).toBe('async-loaded'))
    expect(session.getApp()?.globalData.events).toEqual(['load', 'show', 'success', 'complete', 'loaded', 'ready', 'routeDone'])
    expect(session.renderCurrentPage().wxml).toContain('>async-loaded<')
  })

  it('does not wait for an unresolved promise returned by onLoad', async () => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index?mode=pending')
    await vi.waitFor(() => expect(page.data.label).toBe('ready-without-load'))
    expect(session.getApp()?.globalData.events).toEqual(['load', 'show', 'ready', 'routeDone'])
  })

  it('renders page data before completing the setData callback', async () => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index?mode=pending')
    await vi.waitFor(() => expect(page.data.label).toBe('ready-without-load'))
    const render = vi.spyOn(session, 'renderCurrentPage')
    const callback = vi.fn(() => {
      expect(render).toHaveBeenCalled()
      expect(render.mock.results.at(-1)?.value.wxml).toContain('>render-completed<')
    })

    page.setData({ label: 'render-completed' }, callback)
    expect(page.data.label).toBe('render-completed')
    expect(callback).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce())
  })

  it.each(['load', 'show', 'ready'])('stops later lifecycles when %s redirects the page', async (hook) => {
    const session = createSession()
    session.reLaunch(`/pages/index/index?mode=${hook}-redirect`)
    await vi.waitFor(() => {
      expect(session.getCurrentPages().at(-1)?.route).toBe('pages/destination/index')
      expect(session.getCurrentPages().at(-1)?.data.ready).toBe(true)
    })
    const events = session.getApp()?.globalData.events as string[]
    expect(events).not.toContain('routeDone')
    if (hook === 'load') {
      expect(events).not.toContain('show')
    }
    if (hook !== 'ready') {
      expect(events).not.toContain('ready')
    }
  })

  it('does not run readiness for a page unloaded before its queued task', async () => {
    const session = createSession()
    session.reLaunch('/pages/index/index')
    const next = session.reLaunch('/pages/destination/index')
    await vi.waitFor(() => expect(next.data.ready).toBe(true))
    expect(session.getApp()?.globalData.events).not.toContain('ready')
    expect(session.getApp()?.globalData.events).not.toContain('routeDone')
  })

  it('cancels queued readiness when the session closes', async () => {
    vi.useFakeTimers()
    const session = createSession()
    const page = session.reLaunch('/pages/index/index?mode=pending')
    session.close()
    await vi.runAllTimersAsync()
    expect(page.data.label).toBe('pending')
  })

  it('records ready errors as runtime exceptions without dispatching routeDone', async () => {
    const session = createSession()
    session.reLaunch('/pages/index/index?mode=throw')
    await vi.waitFor(() => expect(session.getDiagnostics()).toHaveLength(1))
    expect(session.getDiagnostics()[0]?.level).toBe('exception')
    expect(String(session.getDiagnostics()[0]?.args[0])).toContain('page-ready-error')
    expect(session.getApp()?.globalData.events).not.toContain('routeDone')
  })
})
