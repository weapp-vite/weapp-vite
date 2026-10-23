import type { HeadlessWx, HeadlessWxRouteDoneEvent, HeadlessWxRouteEvent } from '../src/host'
import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createRouteRendererFiles } from '../test/helpers/routeEvents'

it.each(['webview', 'skyline'] as const)('observes %s through route acceptance while completion keeps only route identity', async (renderer) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createRouteRendererFiles(renderer)) })
  try {
    session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const records = app.globalData.events as Array<{ stage: string, renderer?: string }>
    await vi.waitFor(() => expect(records.at(-1)?.stage).toBe('done'))
    expect(records.find(event => event.stage === 'route')?.renderer).toBe(renderer)
    const accepted: HeadlessWxRouteEvent[] = []
    const completed: HeadlessWxRouteDoneEvent[] = []
    const wx = app.getWx() as HeadlessWx
    wx.onAppRoute(event => accepted.push(event))
    wx.onAppRouteDone(event => completed.push(event))
    session.redirectTo('/pages/detail/index?source=browser-renderer-contract')
    await vi.waitFor(() => expect(completed).toHaveLength(1))
    expect(accepted).toHaveLength(1)
    expect(accepted[0]).toMatchObject({ renderer, path: 'pages/detail/index' })
    expect(completed[0]).toEqual({
      path: accepted[0]!.path,
      query: { source: 'browser-renderer-contract' },
      openType: 'redirectTo',
      webviewId: accepted[0]!.webviewId,
      routeEventId: accepted[0]!.routeEventId,
      timeStamp: accepted[0]!.timeStamp,
    })
    expect(completed[0]).not.toHaveProperty('renderer')
  }
  finally {
    session.close()
  }
})
