import type { HeadlessPageInstance } from '../src/runtime'
import type { HeadlessTestingNodeEventInit } from '../src/view/nodeEvents'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { nativeRefresherFiles } from './helpers/nativeRefresher'

const tempDirs: string[] = []
const sessions: Array<{ close: () => void }> = []

function createProject() {
  const projectPath = createBaseFixture()
  tempDirs.push(projectPath)
  for (const [file, source] of nativeRefresherFiles) {
    const output = path.join(projectPath, 'dist', file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, source)
  }
  return projectPath
}

function commit(instance: Pick<HeadlessPageInstance, 'setData'>, patch: Record<string, unknown>) {
  return new Promise<void>(resolve => instance.setData(patch, resolve))
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  sessions.splice(0).forEach(session => session.close())
  vi.useRealTimers()
  cleanupTempDirs(tempDirs)
})

describe.each(['node', 'browser'] as const)('%s native refresher contract', (provider) => {
  async function setup() {
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath: createProject() })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeRefresherFiles) })
    sessions.push(session)
    const page = session.reLaunch('/pages/index/index')
    await commit(page, {})
    vi.useFakeTimers()
    const types = () => page.data.events.map((event: { type: string }) => event.type)
    const node = (selector = '#primary') => querySelectorAll(session.renderCurrentPage().root, selector)[0]!
    const touch = (name: string, y: number, selector = '#primary', x = 20) => {
      const point = { identifier: 1, clientX: x, clientY: y, pageX: x, pageY: y }
      const event: HeadlessTestingNodeEventInit = {
        touches: name === 'touchend' || name === 'touchcancel' ? [] : [point],
        changedTouches: [point],
      }
      return session.dispatchNativeNodeEvent(node(selector), name, event)
    }
    const pull = async (distance: number, selector = '#primary') => {
      touch('touchstart', 10, selector)
      touch('touchmove', 10 + distance, selector)
      touch('touchend', 10 + distance, selector)
      await flush()
    }
    return { session, page, types, node, touch, pull }
  }

  it('emits programmatic pulling before refresh and consumes each explicit commit once', async () => {
    const { session, page, types } = await setup()
    await commit(page, { 'state.triggered': true })
    expect(types()).toEqual(['refresherpulling'])
    await vi.advanceTimersByTimeAsync(250)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'state.triggered': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    session.renderCurrentPage()
    page.measure()
    await commit(page, { noise: 1 })
    await vi.advanceTimersByTimeAsync(500)
    expect(types()).toHaveLength(3)
  })

  it('aborts a short pull and restores a gesture refresh on an equal false patch only', async () => {
    const { session, page, types, pull } = await setup()
    await pull(20)
    expect(types()).toEqual(['refresherpulling', 'refresherabort'])
    await vi.advanceTimersByTimeAsync(250)
    await commit(page, { events: [] })
    await pull(110)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    expect(page.data.state.triggered).toBe(false)
    session.renderCurrentPage()
    page.measure()
    await commit(page, { 'state.sibling': 1, 'noise': 1 })
    expect(types()).toHaveLength(2)
    // 同一提交批次不能因后续无关 patch 而丢失等值 false 命令。
    const stopped = commit(page, { 'state.triggered': false })
    page.setData({ noise: 2 })
    await stopped
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('ignores restore callback reentry until the next explicit true commit after recovery', async () => {
    const { page, types, pull } = await setup()
    await pull(110)
    await commit(page, { 'reenter': true, 'state.triggered': false })
    await vi.advanceTimersByTimeAsync(500)
    expect(page.data.state.triggered).toBe(true)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    await commit(page, { 'state.triggered': true })
    await vi.advanceTimersByTimeAsync(250)
    expect(types().slice(-2)).toEqual(['refresherpulling', 'refresherrefresh'])
  })

  it('keeps component commits scoped and excludes unrelated page and component updates', async () => {
    const { session, page, types, pull } = await setup()
    await pull(110, '#local')
    const panel = session.selectComponent('#panel')!
    expect(panel.data.events).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'state.triggered': false })
    await commit(panel, { noise: 1 })
    expect(panel.data.events).toHaveLength(2)
    expect(types()).toEqual([])
    await commit(panel, { triggered: false })
    expect(panel.data.events).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('delivers equal commits through a custom component property without query replay', async () => {
    const { session, page, pull } = await setup()
    await pull(110, '#external')
    const panel = session.selectComponent('#panel')!
    await commit(page, { 'state.sibling': 1 })
    expect(panel.data.events).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'state.triggered': false })
    expect(panel.data.events).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    session.selectComponent('#panel')
    await vi.advanceTimersByTimeAsync(500)
    expect(panel.data.events).toHaveLength(3)
  })

  it('tracks computed dependencies and loop aliases without consuming sibling paths', async () => {
    const { page, types, pull } = await setup()
    await pull(110, '#derived')
    await commit(page, { 'states[1].triggered': false })
    expect(types()).toHaveLength(2)
    await commit(page, { 'states[0].triggered': false })
    expect(types().at(-1)).toBe('refresherrestore')
    await vi.advanceTimersByTimeAsync(250)
    await commit(page, { events: [] })
    await pull(110, '#item')
    await commit(page, { 'items[0].triggered': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('keeps primitive loop aliases distinct from equal sibling and shadowed page values', async () => {
    const { page, types, pull } = await setup()
    await pull(110, '#flag-0')
    await commit(page, { 'flags[1]': false, 'flag': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'flags[0]': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('keeps equal WXS scalars independent of the page fields they shadow', async () => {
    const { page, types, pull } = await setup()
    await pull(110, '#wxs-shadow')
    await commit(page, { shadowedFlag: false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { shadowedFlag: true })
    await commit(page, { shadowedFlag: false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
  })

  it('preserves scalar template parameter origins for equal commits', async () => {
    const { page, types, pull } = await setup()
    await pull(110, '#scalar')
    await commit(page, { 'scalarState.sibling': 1 })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'scalarState.triggered': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it.each([
    { selector: '#nested-scalar', sibling: 'noise', related: 'scalarState.triggered' },
    { selector: '#spread-scalar', sibling: 'scalarSources[0].sibling', related: 'scalarSources[0].alias' },
    { selector: '#literal-0', sibling: 'flags[1]', related: 'flags[0]' },
  ])('preserves exact origins through reconstructed scope $selector', async ({ selector, sibling, related }) => {
    const { page, types, pull } = await setup()
    await pull(110, selector)
    await commit(page, { [sibling]: false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { [related]: false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('tracks missing spread keys without treating the whole source as a command', async () => {
    const { page, types, pull } = await setup()
    await pull(110, '#optional-scalar')
    await commit(page, { 'optionalSource.noise': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    await commit(page, { 'optionalSource.alias': false })
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
  })

  it('preserves user scrolling and ignores horizontal, upward, and multiple-touch starts', async () => {
    const { session, page, types, node, touch, pull } = await setup()
    session.dispatchNativeNodeEvent(node(), 'scroll', { detail: { scrollTop: 40 } })
    await pull(110)
    expect(types()).toEqual([])
    expect(page.measure()).toEqual({ scrollTop: 40, scrollLeft: 0 })
    session.dispatchNativeNodeEvent(node(), 'scroll', { detail: { scrollTop: 0 } })
    touch('touchstart', 10)
    touch('touchmove', 30, '#primary', 120)
    touch('touchend', 30, '#primary', 120)
    touch('touchstart', 110)
    touch('touchmove', 10)
    touch('touchend', 10)
    session.dispatchNativeNodeEvent(node(), 'touchstart', { touches: [{ identifier: 1 }, { identifier: 2 }] })
    touch('touchmove', 110)
    touch('touchend', 110)
    await flush()
    expect(types()).toEqual([])
    await pull(110)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    expect(page.measure()).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it('silently cancels pending refreshes on disable, removal, and session close', async () => {
    const { session, page, types } = await setup()
    await commit(page, { 'state.triggered': true })
    await commit(page, { enabled: false })
    await vi.advanceTimersByTimeAsync(500)
    expect(types()).toEqual(['refresherpulling'])
    await commit(page, { 'enabled': true, 'state.triggered': false })
    await commit(page, { 'state.triggered': true })
    await commit(page, { visible: false })
    await vi.advanceTimersByTimeAsync(500)
    expect(types()).toEqual(['refresherpulling', 'refresherpulling'])
    await commit(page, { visible: true })
    await flush()
    const count = types().length
    session.close()
    await vi.advanceTimersByTimeAsync(500)
    expect(types()).toHaveLength(count)
  })
})
