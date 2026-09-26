import type { HeadlessPageInstance } from '../src/runtime'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { nativeScrollFiles } from './helpers/nativeScroll'
import { nativeTapOwnershipFiles } from './helpers/nativeTapOwnership'

const tempDirs: string[] = []
const sessions: Array<{ close: () => void | Promise<void> }> = []

function setDataAndCommit(page: HeadlessPageInstance, patch: Record<string, unknown>) {
  return new Promise<void>(resolve => page.setData(patch, resolve))
}

function createProject(files = nativeScrollFiles) {
  const projectPath = createBaseFixture()
  tempDirs.push(projectPath)
  for (const [file, source] of files) {
    const output = path.join(projectPath, 'dist', file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, source)
  }
  return projectPath
}

afterEach(async () => {
  for (const session of sessions.splice(0)) {
    await session.close()
  }
  cleanupTempDirs(tempDirs)
})

describe.each(['node', 'browser'] as const)('%s native scroll and tap behavior', (provider) => {
  async function createSession(files = nativeScrollFiles) {
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath: createProject(files) })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    sessions.push(session)
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(session.getApp()!.globalData.stages.at(-1)).toBe('done'))
    return { session, page }
  }

  it('clamps bindings to real inline boxes without echoing empty or unsupported geometry', async () => {
    const { page } = await createSession()
    await setDataAndCommit(page, { top: 900, left: 900 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 300, scrollLeft: 200 })
    expect(page.measure('#empty')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    expect(page.measure('#vertical')).toEqual({ scrollTop: 300, scrollLeft: 0 })
    expect(page.measure('#unsupported')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    await vi.waitFor(() => expect(page.data.scrolls).toEqual([{ scrollTop: 300, scrollLeft: 200 }]))
  })

  it('reclamps shrinking and removed content without replaying an unchanged request when it grows', async () => {
    const { page } = await createSession()
    await setDataAndCommit(page, { top: 250, left: 150 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 250, scrollLeft: 150 })
    await setDataAndCommit(page, { height: 140, width: 130 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 40, scrollLeft: 30 })
    await setDataAndCommit(page, { height: 40, width: 50 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    await setDataAndCommit(page, { height: 400, width: 300, top: 240, left: 140 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 240, scrollLeft: 140 })
    await setDataAndCommit(page, { content: false })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    await setDataAndCommit(page, { content: true })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    await vi.waitFor(() => expect(page.data.scrolls).toEqual([
      { scrollTop: 250, scrollLeft: 150 },
      { scrollTop: 40, scrollLeft: 30 },
      { scrollTop: 0, scrollLeft: 0 },
      { scrollTop: 240, scrollLeft: 140 },
      { scrollTop: 0, scrollLeft: 0 },
    ]))
  })

  it('keeps user offsets independent from unchanged bindings and clamps each enabled axis', async () => {
    const { session, page } = await createSession()
    await setDataAndCommit(page, { top: 100, left: 80 })
    const node = querySelectorAll(session.renderCurrentPage().root, '#scroller')[0]!
    session.dispatchNativeNodeEvent(node, 'scroll', { detail: { scrollTop: 230, scrollLeft: 160 } })
    await setDataAndCommit(page, { unrelated: true })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 230, scrollLeft: 160 })
    await setDataAndCommit(page, { x: false })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 230, scrollLeft: 0 })
    session.dispatchNativeNodeEvent(node, 'scroll', { detail: { scrollTop: 900, scrollLeft: 900 } })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 300, scrollLeft: 0 })
    await setDataAndCommit(page, { y: false, x: true, top: 200, left: 120 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 120 })
    await setDataAndCommit(page, { y: true, top: 0, left: 0 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it('sanitizes negative and nonfinite requests and user events before observers see them', async () => {
    const { session, page } = await createSession()
    await setDataAndCommit(page, { top: -50, left: Number.POSITIVE_INFINITY })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
    const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      dispatchNativeEvent: (node, eventName, event, onHandlerResult) => session.dispatchNativeNodeEvent(node, eventName, event, onHandlerResult),
      createPageHandle: () => ({ data: async () => page.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
    const scroller = (await root.$('#scroller'))!
    await scroller.trigger('scroll', { detail: { scrollTop: 900, scrollLeft: 900 } })
    expect(page.data.scrolls.at(-1)).toEqual({ scrollTop: 300, scrollLeft: 200 })
    await scroller.trigger('scroll', { detail: { scrollTop: Number.NaN, scrollLeft: -20 } })
    expect(page.data.scrolls.at(-1)).toEqual({ scrollTop: 0, scrollLeft: 0 })
    expect(page.measure('#scroller')).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it.each([
    ['caught', [{ target: 'caught', currentTarget: 'caught' }]],
    ['nested', [{ target: 'nested', currentTarget: 'nested' }, { target: 'nested', currentTarget: 'middle' }]],
    ['nested-unbound', [{ target: 'nested-unbound', currentTarget: 'middle' }]],
  ])('executes catching handlers once and blocks ancestor navigation for %s', async (id, taps) => {
    const { session, page } = await createSession()
    const stages = session.getApp()!.globalData.stages as string[]
    stages.length = 0
    const node = querySelectorAll(session.renderCurrentPage().root, `#${id}`)[0]!
    expect(session.dispatchNativeNodeEvent(node, 'tap', {})).toBe(true)
    expect(page.data.taps).toEqual(taps)
    expect(session.getCurrentPages()).toEqual([page])
    expect(stages).toEqual([])
  })

  it.each(['unbound', 'own-catch'])('keeps the native navigator default for %s', async (id) => {
    const { session, page } = await createSession()
    const node = querySelectorAll(session.renderCurrentPage().root, `#${id}`)[0]!
    session.dispatchNativeNodeEvent(node, 'tap', {})
    expect(session.getCurrentPages().at(-1)?.route).toBe('pages/detail/index')
    expect(page.data.taps).toEqual(id === 'own-catch' ? [{ target: id, currentTarget: id }] : [])
  })

  it('does not treat a catch above the navigator as cancellation of its native default', async () => {
    const { session, page } = await createSession()
    const node = querySelectorAll(session.renderCurrentPage().root, '#below-navigator')[0]!
    session.dispatchNativeNodeEvent(node, 'tap', {})
    expect(page.data.taps).toEqual([{ target: 'below-navigator', currentTarget: 'above' }])
    expect(session.getCurrentPages().at(-1)?.route).toBe('pages/detail/index')
  })

  it('executes ordinary tap handlers without creating navigation', async () => {
    const { session, page } = await createSession()
    const stages = session.getApp()!.globalData.stages as string[]
    stages.length = 0
    const node = querySelectorAll(session.renderCurrentPage().root, '#ordinary')[0]!
    session.dispatchNativeNodeEvent(node, 'tap', {})
    expect(page.data.taps).toEqual([{ target: 'ordinary', currentTarget: 'ordinary' }])
    expect(session.getCurrentPages()).toEqual([page])
    expect(stages).toEqual([])
  })

  it.each(['remove', 'remove-and-render', 'reLaunch'])('keeps tap ownership after synchronous component %s', async (action) => {
    const { session, page } = await createSession(nativeTapOwnershipFiles)
    await setDataAndCommit(page, { action })
    const node = querySelectorAll(session.renderCurrentPage().root, '#leaf')[0]!
    const mark = { interaction: 'original' }
    const event = { detail: {}, mark }
    expect(session.dispatchNativeNodeEvent(node, 'tap', event)).toBe(true)
    expect(session.getApp()!.globalData.taps).toEqual([
      { owner: 'component', identity: 1, type: 'tap', target: 'leaf', currentTarget: 'leaf', mark },
      { owner: 'page', identity: 1, type: 'close', target: 'card', currentTarget: 'card', mark },
      { owner: 'component', identity: 1, type: 'tap', target: 'leaf', currentTarget: 'ancestor', mark },
      { owner: 'component', identity: 1, type: 'tap', target: 'leaf', currentTarget: 'navigator', mark },
      { owner: 'page', identity: 1, type: 'tap', target: 'leaf', currentTarget: 'outer', mark },
    ])
    expect(page.data.visible).toBe(false)
    const pages = session.getCurrentPages()
    expect(pages.map(entry => entry.route)).toEqual(['pages/index/index', 'pages/detail/index'])
    expect(pages[1]!.options).toEqual({ from: 'default' })
    if (action === 'reLaunch') {
      expect(pages[0]).not.toBe(page)
      expect(pages[0]!.options).toEqual({ replacement: 'true' })
    }
    else {
      expect(pages[0]).toBe(page)
    }
  })

  it('waits for asynchronous tap handlers and preserves their result and rejection', async () => {
    const { session, page } = await createSession()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    page.onTap = async () => {
      await gate
      await setDataAndCommit(page, { completed: true })
      return 'completed'
    }
    const node = querySelectorAll(session.renderCurrentPage().root, '#ordinary')[0]!
    const handle = new HeadlessTestingNodeHandle(node, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      dispatchNativeEvent: (target, type, event, onHandlerResult) => session.dispatchNativeNodeEvent(target, type, event, onHandlerResult),
      createPageHandle: () => ({ data: async () => page.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
    let settled = false
    const pending = handle.tap().then((result) => {
      settled = true
      return result
    })
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    expect(page.data.completed).toBeUndefined()
    release()
    expect(await pending).toBe('completed')
    expect(page.data.completed).toBe(true)
    const failure = new Error('tap failed')
    page.onTap = async () => {
      throw failure
    }
    await expect(handle.tap()).rejects.toBe(failure)
  })
})

it('uses the same native propagation through the public testing bridge without duplicate handlers', async () => {
  const miniProgram = await launch({ projectPath: createProject() })
  sessions.push(miniProgram)
  const page = await miniProgram.reLaunch('/pages/index/index')
  await (await page.$('#nested'))!.tap()
  expect(await page.data('taps')).toEqual([
    { target: 'nested', currentTarget: 'nested' },
    { target: 'nested', currentTarget: 'middle' },
  ])
  expect((await miniProgram.currentPage())?.pageId).toBe(page.pageId)
  await (await page.$('#unbound'))!.tap()
  expect((await miniProgram.currentPage())?.path).toBe('pages/detail/index')
})
