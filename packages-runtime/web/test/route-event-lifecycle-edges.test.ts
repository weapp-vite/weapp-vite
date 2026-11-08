import type { ComponentPublicInstance } from '../src/runtime/component'
import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { WEVU_HOST_COMMIT_PROMISE_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beginAppRoute,
  cancelEntryRoute,
  emitBeforePageUnload,
  finishAppRoute,
  offAppRoute,
  offAppRouteDone,
  offBeforeAppRoute,
  offBeforePageUnload,
  onAppRoute,
  onAppRouteDone,
  onBeforeAppRoute,
  onBeforePageUnload,
} from '../src/runtime/polyfill/routeRuntime/events'

function createEntry(): PageStackEntry {
  return { active: true, id: 'pages/route-boundary', query: { entry: 'test' } }
}

function page(commit?: Promise<unknown>) {
  return { [WEVU_HOST_COMMIT_PROMISE_KEY]: commit } as unknown as ComponentPublicInstance & {
    [WEVU_HOST_COMMIT_PROMISE_KEY]?: Promise<unknown>
  }
}

afterEach(() => {
  offBeforeAppRoute()
  offAppRoute()
  offAppRouteDone()
  offBeforePageUnload()
  vi.restoreAllMocks()
})

describe('route notification lifecycle boundaries', () => {
  it('isolates failed route observers and emits unload only for an entry with a mounted page', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const thrown = new Error('route observer failed')
    const healthy = vi.fn()
    const unload = vi.fn()
    onBeforeAppRoute(() => {
      throw thrown
    })
    onBeforeAppRoute(healthy)
    onBeforePageUnload(unload)
    const entry = createEntry()
    const event = beginAppRoute(entry, 'navigateTo')
    expect(healthy).toHaveBeenCalledExactlyOnceWith(event)
    expect(error).toHaveBeenCalledExactlyOnceWith(thrown)
    emitBeforePageUnload(entry, event)
    expect(unload).not.toHaveBeenCalled()
    entry.instance = page()
    emitBeforePageUnload(entry, event)
    expect(unload).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ page: entry.instance, path: entry.id }))
  })

  it('defers mounted notification until an active instance exists and honors navigation inside its route callback', () => {
    const entry = createEntry()
    entry.active = false
    const event = beginAppRoute(entry, 'navigateTo')
    const mounted = vi.fn(() => cancelEntryRoute(entry))
    const done = vi.fn()
    onAppRoute(mounted)
    onAppRouteDone(done)
    finishAppRoute(entry, event)
    entry.onRouteMounted!()
    entry.active = true
    entry.onRouteMounted!()
    expect(mounted).not.toHaveBeenCalled()
    entry.instance = page()
    entry.onRouteMounted!()
    expect(mounted).toHaveBeenCalledOnce()
    expect(entry.onRouteReady).toBeUndefined()
    expect(done).not.toHaveBeenCalled()
  })

  it('reports a failed host commit without emitting route done', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failed = new Error('host render failed')
    const entry = createEntry()
    entry.instance = page()
    const event = beginAppRoute(entry, 'navigateTo')
    const done = vi.fn()
    onAppRouteDone(done)
    finishAppRoute(entry, event)
    entry.onRouteReady!()
    expect(done).not.toHaveBeenCalled()
    entry.ready = true
    const commit = Promise.reject(failed)
    ;(entry.instance as ReturnType<typeof page>)[WEVU_HOST_COMMIT_PROMISE_KEY] = commit
    entry.onRouteReady!()
    await Promise.resolve()
    expect(error).toHaveBeenCalledExactlyOnceWith(failed)
    expect(done).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'replace'] as const)('suppresses completion after a pending host commit when the page is %s', async (action) => {
    let resolve!: () => void
    const commit = new Promise<void>((done) => {
      resolve = done
    })
    const entry = createEntry()
    entry.instance = page(commit)
    entry.ready = true
    const event = beginAppRoute(entry, 'navigateTo')
    const done = vi.fn()
    onAppRouteDone(done)
    finishAppRoute(entry, event)
    if (action === 'cancel') {
      cancelEntryRoute(entry)
    }
    else {
      entry.instance = page()
    }
    resolve()
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
  })
})
