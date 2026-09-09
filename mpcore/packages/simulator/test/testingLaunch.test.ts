import type { HeadlessSession } from '../src'
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

describe('headless testing launch configuration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('awaits session configuration before app bootstrap', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), `
App({
  onLaunch() {
    wx.setStorageSync('bootstrap-observed', wx.getStorageSync('configured-before-bootstrap'))
  },
})
`)
    let configuredSession: HeadlessSession | undefined
    const miniProgram = await launch({
      async configureSession(session) {
        configuredSession = session
        await Promise.resolve()
        session.getWx().setStorageSync('configured-before-bootstrap', 'ready')
      },
      projectPath,
    })

    try {
      expect(configuredSession?.getApp()).not.toBeNull()
      await expect(miniProgram.callWxMethod('getStorageSync', 'bootstrap-observed'))
        .resolves
        .toBe('ready')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('closes the constructed session when async configuration fails', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    let configuredSession: HeadlessSession | undefined

    await expect(launch({
      async configureSession(session) {
        configuredSession = session
        await Promise.resolve()
        throw new Error('configuration failed')
      },
      projectPath,
    })).rejects.toThrow('configuration failed')
    expect(configuredSession?.isClosed).toBe(true)
  })

  it('closes the configured session when app bootstrap fails', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    fs.writeFileSync(
      path.join(projectPath, 'dist/app.js'),
      'throw new Error("bootstrap failed")\n',
    )
    let configuredSession: HeadlessSession | undefined

    await expect(launch({
      configureSession(session) {
        configuredSession = session
      },
      projectPath,
    })).rejects.toThrow('bootstrap failed')
    expect(configuredSession?.isClosed).toBe(true)
  })

  it('keeps unconfigured launch requests on the existing mock-only failure path', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })
    let failure: Error | undefined
    let completeCalls = 0

    try {
      await miniProgram.callWxMethod('request', {
        complete() {
          completeCalls += 1
        },
        fail(error: Error) {
          failure = error
        },
        url: 'http://127.0.0.1:54321/query/items',
      })
      expect(failure?.message).toContain('No request mock matched in headless runtime')
      expect(completeCalls).toBe(1)
    }
    finally {
      await miniProgram.close()
    }
  })
})
