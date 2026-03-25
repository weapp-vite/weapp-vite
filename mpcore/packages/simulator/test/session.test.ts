import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'

describe('HeadlessSession', () => {
  it('bootstraps a built app and reLaunches a page', () => {
    const session = createHeadlessSession({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const app = session.bootstrap()
    expect(app).toBeTruthy()

    const page = session.reLaunch('/pages/index/index')
    expect(page.route).toBe('/pages/index/index')
    expect(page.data.__e2eResult).toEqual({
      status: 'ready',
      detail: 'rendered',
    })
    expect(session.getCurrentPages()).toHaveLength(1)
  })

  it('binds page methods to the page instance and applies setData', () => {
    const session = createHeadlessSession({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const page = session.reLaunch('/pages/index/index')
    expect(page.data.__e2eResult.status).toBe('ready')

    page.onTap()

    expect(page.data.__e2eResult).toEqual({
      status: 'tapped',
      detail: 'tap handled',
    })
  })

  it('runs unload and recreates the page on reLaunch', () => {
    const session = createHeadlessSession({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const firstPage = session.reLaunch('/pages/index/index')
    firstPage.setData({
      'transient.value': 1,
    })

    const secondPage = session.reLaunch('/pages/index/index')
    expect(secondPage).not.toBe(firstPage)
    expect(secondPage.data.transient).toBeUndefined()
    expect(session.getCurrentPages()).toHaveLength(1)
  })
})
