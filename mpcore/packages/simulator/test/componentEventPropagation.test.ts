import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs } from './helpers'
import { componentEventPropagationFiles } from './helpers/componentEventPropagation'

describe.each(['node', 'browser'] as const)('%s component event propagation', (provider) => {
  const directories: string[] = []
  const sessions: Array<{ close: () => void }> = []
  afterEach(() => {
    sessions.splice(0).forEach(session => session.close())
    cleanupTempDirs(directories)
  })

  function createSession() {
    let session
    if (provider === 'browser') {
      session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentEventPropagationFiles) })
    }
    else {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-event-propagation-'))
      directories.push(projectPath)
      for (const [file, source] of componentEventPropagationFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      session = createHeadlessSession({ projectPath })
    }
    sessions.push(session)
    return session
  }

  function expectedLocalEvents(value: number) {
    const target = { id: 'source-host', dataset: { source: 'probe' } }
    return [
      { phase: 'capture', detail: { value }, target, currentTarget: { id: 'capture-view', dataset: { listener: 'capture' } } },
      { phase: 'direct', detail: { value }, target, currentTarget: target },
      { phase: 'bubble', detail: { value }, target, currentTarget: { id: 'bubble-view', dataset: { listener: 'bubble' } } },
    ]
  }

  it('visits ordinary view ancestors in order and only crosses the declaring tree when composed', () => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index')
    session.renderCurrentPage()
    const boundary = session.selectComponent('#boundary')!
    const source = boundary.selectComponent!('#source-host')!

    for (const [kind, value, pageCount] of [['local', 23, 0], ['public', 37, 1]] as const) {
      boundary.setData({ events: [], trace: '' })
      const root = session.renderCurrentPage().root
      const button = querySelectorAll(root, `#source-host #emit-${kind}`)[0]!
      session.dispatchNativeNodeEvent(button, 'tap', {})

      expect(boundary.data.events).toEqual(expectedLocalEvents(value))
      expect(page.data.pageCount).toBe(pageCount)
      expect(page.data.pageValue).toBe(pageCount ? value : 0)
      session.renderCurrentPage()
      expect(session.selectComponent('#boundary')).toBe(boundary)
      expect(boundary.selectComponent!('#source-host')).toBe(source)
    }
  })

  it.each([
    ['private', 11, 'direct'],
    ['capture', 19, 'capture,direct'],
  ] as const)('keeps %s delivery independent from bubbling', (kind, value, trace) => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index')
    const button = querySelectorAll(session.renderCurrentPage().root, `#source-host #emit-${kind}`)[0]!
    session.dispatchNativeNodeEvent(button, 'tap', {})

    const boundary = session.selectComponent('#boundary')!
    expect(boundary.data.trace).toBe(trace)
    expect(boundary.data.value).toBe(value)
    expect(page.data.pageCount).toBe(0)
    expect(page.data.pageValue).toBe(0)
  })

  it.each([
    ['catch-host', 'capture,catch'],
    ['capture-catch-host', 'capture,capture-catch'],
  ] as const)('stops a composed signal at %s after earlier capture receivers', (host, trace) => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index')
    const button = querySelectorAll(session.renderCurrentPage().root, `#${host} #emit-public`)[0]!
    session.dispatchNativeNodeEvent(button, 'tap', {})

    const boundary = session.selectComponent('#boundary')!
    expect(boundary.data.trace).toBe(trace)
    expect(boundary.data.value).toBe(37)
    expect(boundary.data.source).toBe(host)
    expect(page.data.pageCount).toBe(0)
    expect(page.data.pageValue).toBe(0)
  })

  it('retains reachable listener instances when capture removes and rerenders the declaring tree', () => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index')
    session.renderCurrentPage()
    const boundary = session.selectComponent('#boundary')!
    const onCapture = boundary.onCapture
    boundary.onCapture = function (event: unknown) {
      onCapture.call(this, event)
      page.setData({ visible: false })
      session.renderCurrentPage()
    }
    const button = querySelectorAll(session.renderCurrentPage().root, '#source-host #emit-public')[0]!
    session.dispatchNativeNodeEvent(button, 'tap', {})

    expect(boundary.data.events).toEqual(expectedLocalEvents(37))
    expect(page.data.pageCount).toBe(1)
    expect(page.data.pageValue).toBe(37)
    expect(session.selectComponent('#boundary')).toBeNull()
  })
})
