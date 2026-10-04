import type { HeadlessWx } from '../src/host'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { navigationCompletionFiles, navigationCompletionRoutes } from './helpers/navigationCompletion'

const tempDirs: string[] = []
const sessions: Array<{ close: () => void }> = []

afterEach(() => {
  for (const session of sessions.splice(0)) {
    session.close()
  }
  cleanupTempDirs(tempDirs)
})

function createSession() {
  const projectPath = createBaseFixture()
  tempDirs.push(projectPath)
  for (const [file, source] of navigationCompletionFiles) {
    const output = path.join(projectPath, 'dist', file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, source)
  }
  const session = createHeadlessSession({ projectPath })
  sessions.push(session)
  return session
}

it('finishes each native navigateTo after the target Page ready lifecycle', async () => {
  const session = createSession()
  const home = session.reLaunch(`/${navigationCompletionRoutes[0]}`)
  await vi.waitFor(() => expect(home.data.ready).toBe(true))
  const app = session.getApp()!
  const wx = app.getWx() as HeadlessWx
  const order = app.globalData.order as string[]

  for (const route of navigationCompletionRoutes.slice(1)) {
    order.length = 0
    let readyAtSuccess: unknown
    await new Promise<void>((resolve, reject) => {
      wx.navigateTo({
        url: `/${route}`,
        success() {
          readyAtSuccess = session.getCurrentPages().at(-1)?.data.ready
          order.push(`success:${route}`)
        },
        complete() {
          order.push(`complete:${route}`)
          resolve()
        },
        fail: reject,
      })
    })
    expect(readyAtSuccess).toBe(true)
    expect(order).toEqual([
      `load:${route}`,
      `show:${route}`,
      `ready:${route}`,
      `success:${route}`,
      `complete:${route}`,
    ])
  }
})

it.each(['close', 'supersede'] as const)('settles the owned navigation once when the page is canceled by %s', async (action) => {
  const session = createSession()
  const home = session.reLaunch(`/${navigationCompletionRoutes[0]}`)
  await vi.waitFor(() => expect(home.data.ready).toBe(true))
  const wx = session.getApp()!.getWx() as HeadlessWx
  const target = navigationCompletionRoutes[1]!
  const callbacks: string[] = []
  wx.onAppRoute((event) => {
    if (event.path === target) {
      queueMicrotask(() => {
        if (action === 'close') {
          session.close()
        }
        else {
          session.redirectTo(`/${navigationCompletionRoutes[2]}`)
        }
      })
    }
  })
  await new Promise<void>((resolve) => {
    wx.navigateTo({
      url: `/${target}`,
      success: () => { callbacks.push('success') },
      fail: () => { callbacks.push('fail') },
      complete() {
        callbacks.push('complete')
        resolve()
      },
    })
  })
  session.close()
  session.close()
  expect(callbacks).toEqual(['fail', 'complete'])
})
