import type { HeadlessTestingSessionHandle } from '../src/testing'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('testing launch diagnostics', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('subscribes before app evaluation, lifecycle and first page rendering', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), `
console.info('app:evaluate')
App({ onLaunch() { console.info('app:launch') } })
`)
    fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.js'), `
Page({ data: { greeting: 'ready' }, onLoad() { console.info('page:load') } })
`)
    fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.wxml'), '<text id="result">{{greeting}}</text>')
    const entries: unknown[] = []
    const session = await launch({
      projectPath,
      async onSessionCreated(handle) {
        expect(await handle.currentPage()).toBeNull()
        handle.on('console', entry => entries.push(entry))
      },
    })
    expect(entries).toEqual([
      { level: 'info', args: ['app:evaluate'] },
      { level: 'info', args: ['app:launch'] },
      { level: 'info', args: ['page:load'] },
    ])
    const page = await session.currentPage()
    expect(await (await page?.$('#result'))?.text()).toBe('ready')
    await session.close()
  })

  it('closes the created session when the subscription hook fails', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    let handle: HeadlessTestingSessionHandle | undefined
    await expect(launch({
      projectPath,
      onSessionCreated(session) {
        handle = session
        throw new Error('subscription failed')
      },
    })).rejects.toThrow('subscription failed')
    await expect(handle?.currentPage()).rejects.toThrow(/closed/i)
  })

  it.each([
    { entryPagePath: undefined, expectedRoute: 'pages/index/index' },
    { entryPagePath: '/pages/entry/index', expectedRoute: 'pages/entry/index' },
  ])('starts App with the selected initial route $expectedRoute before rendering it', async ({ entryPagePath, expectedRoute }) => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index', 'pages/entry/index'],
      entryPagePath,
    }))
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), `App({
      globalData: { hooks: [] },
      onLaunch(options) { this.globalData.hooks.push({ hook: 'onLaunch', options }) },
      onShow(options) { this.globalData.hooks.push({ hook: 'onShow', options }) },
    })`)
    for (const route of ['pages/index/index', 'pages/entry/index']) {
      const pageRoot = path.join(projectPath, 'dist', route)
      fs.mkdirSync(path.dirname(pageRoot), { recursive: true })
      fs.writeFileSync(`${pageRoot}.js`, `Page({
        data: { hooks: '' },
        onLoad(query) {
          this.setData({ hooks: JSON.stringify(getApp().globalData.hooks), query: JSON.stringify(query) })
        },
      })`)
      fs.writeFileSync(`${pageRoot}.wxml`, '<text id="hooks">{{hooks}}</text><text id="query">{{query}}</text>')
    }
    const session = await launch({ projectPath })
    try {
      const page = await session.currentPage()
      expect(page?.path).toBe(expectedRoute)
      expect(await (await page?.$('#query'))?.text()).toBe('{}')
      const hooks = JSON.parse(await (await page?.$('#hooks'))!.text()) as unknown
      const expectedOptions = { path: expectedRoute, query: {}, referrerInfo: {}, scene: 1001 }
      expect(hooks).toEqual([
        { hook: 'onLaunch', options: expectedOptions },
        { hook: 'onShow', options: expectedOptions },
      ])
    }
    finally {
      await session.close()
    }
  })
})
