import type { HeadlessWx, HeadlessWxRouteDoneEvent, HeadlessWxRouteEvent } from '../src/host'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { createRouteRendererFiles } from './helpers/routeEvents'

const tempDirs: string[] = []
const sessions: Array<{ close: () => void | Promise<void> }> = []

afterEach(async () => {
  for (const session of sessions.splice(0)) {
    await session.close()
  }
  cleanupTempDirs(tempDirs)
})

describe.each(['node', 'browser'] as const)('%s route renderer contract', (provider) => {
  it.each(['webview', 'skyline'] as const)('reports %s on route acceptance without adding it to completion', async (renderer) => {
    const files = createRouteRendererFiles(renderer)
    const projectPath = provider === 'node' ? createBaseFixture() : undefined
    if (projectPath) {
      tempDirs.push(projectPath)
      for (const [file, source] of files) {
        const output = path.join(projectPath, 'dist', file)
        fs.mkdirSync(path.dirname(output), { recursive: true })
        fs.writeFileSync(output, source)
      }
    }
    const session = projectPath
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    sessions.push(session)
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
    session.redirectTo('/pages/detail/index?source=renderer-contract')
    await vi.waitFor(() => expect(completed).toHaveLength(1))
    expect(accepted).toHaveLength(1)
    expect(accepted[0]).toMatchObject({ renderer, path: 'pages/detail/index' })
    expect(completed[0]).toEqual({
      path: accepted[0]!.path,
      query: { source: 'renderer-contract' },
      openType: 'redirectTo',
      webviewId: accepted[0]!.webviewId,
      routeEventId: accepted[0]!.routeEventId,
      timeStamp: accepted[0]!.timeStamp,
    })
    expect(completed[0]).not.toHaveProperty('renderer')
  })
})
