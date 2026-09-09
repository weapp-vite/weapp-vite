import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createAppLaunchOptionsFiles } from './helpers/appLaunchOptions'

function createSession(provider: 'node' | 'browser') {
  const files = createAppLaunchOptionsFiles()
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-app-launch-options-'))
  fs.writeFileSync(path.join(projectPath, 'project.config.json'), '{"appid":"wx1234567890abcdef","miniprogramRoot":"."}')
  for (const [file, source] of files) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = provider === 'node'
    ? createHeadlessSession({ projectPath })
    : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  return {
    session,
    close() {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    },
  }
}

describe.each(['node', 'browser'] as const)('%s App launch boundary', (provider) => {
  it('passes non-default launch inputs intact to both hooks exactly once across page navigation', () => {
    const { session, close } = createSession(provider)
    try {
      const app = session.bootstrap({
        path: 'pages/index/index',
        query: { from: '分享入口', encoded: 'a&b=1' },
        scene: 1047,
        referrerInfo: { appId: 'wx9876543210abcdef', extraData: {} },
      })
      const expectedOptions = {
        path: 'pages/index/index',
        query: { from: '分享入口', encoded: 'a&b=1' },
        scene: 1047,
        referrerInfo: { appId: 'wx9876543210abcdef', extraData: {} },
      }
      const expectedHooks = [
        { hook: 'onLaunch', options: expectedOptions },
        { hook: 'onShow', options: expectedOptions },
      ]
      // Hook 记录由宿主 VM 创建，外层对象原型属于该 realm；参数仍按完整输入严格比较。
      expect(app.globalData.hooks).toEqual(expectedHooks)
      for (const entry of app.globalData.hooks) {
        expect(entry.options).toStrictEqual(expectedOptions)
      }
      expect(session.getLaunchOptions()).toStrictEqual(expectedOptions)
      expect(session.getEnterOptions()).toStrictEqual(expectedOptions)
      expect(app.captureOptions()).toEqual({ launch: expectedOptions, enter: expectedOptions })
      for (const copy of [session.getLaunchOptions(), session.getEnterOptions(), ...Object.values(app.captureOptions())]) {
        const snapshot = copy as ReturnType<typeof session.getLaunchOptions>
        snapshot.path = 'pages/changed/index'
        snapshot.scene = 1001
        snapshot.query.from = 'changed'
        snapshot.referrerInfo.appId = 'changed'
        Object.assign(snapshot.referrerInfo.extraData!, { changed: true })
      }
      expect(session.getLaunchOptions()).toStrictEqual(expectedOptions)
      expect(session.getEnterOptions()).toStrictEqual(expectedOptions)
      session.reLaunch('/pages/index/index?from=%E5%88%86%E4%BA%AB%E5%85%A5%E5%8F%A3&encoded=a%26b%3D1')
      const rendered = session.renderCurrentPage().wxml
      expect(rendered).toContain('>1047</text>')
      expect(rendered).toContain('>pages/index/index</text>')
      session.reLaunch('/pages/next/index?from=later')
      session.bootstrap({ path: 'pages/next/index', query: {}, scene: 1001, referrerInfo: { appId: '', extraData: {} } })
      expect(app.globalData.hooks).toEqual(expectedHooks)
      for (const entry of app.globalData.hooks) {
        expect(entry.options).toStrictEqual(expectedOptions)
      }
      expect(session.getLaunchOptions()).toStrictEqual(expectedOptions)
      expect(app.captureOptions().launch).toEqual(expectedOptions)
    }
    finally {
      close()
    }
  })

  it('keeps an absent referrer empty in normal startup hooks and every options reader', () => {
    const { session, close } = createSession(provider)
    try {
      session.reLaunch('/pages/index/index?from=entry')
      const expectedOptions = { path: 'pages/index/index', query: { from: 'entry' }, referrerInfo: {}, scene: 1001 }
      const app = session.getApp()!
      expect(app.globalData.hooks).toEqual([
        { hook: 'onLaunch', options: expectedOptions },
        { hook: 'onShow', options: expectedOptions },
      ])
      expect(session.getLaunchOptions()).toStrictEqual(expectedOptions)
      expect(session.getEnterOptions()).toStrictEqual(expectedOptions)
      expect(app.captureOptions()).toEqual({ launch: expectedOptions, enter: expectedOptions })
      expect(session.renderCurrentPage().wxml).toContain('>pages/index/index</text>')
    }
    finally {
      close()
    }
  })

  it.each([{ appId: 'wx9876543210abcdef' }, { extraData: {} }])('does not populate absent fields in partial referrer $appId', (referrerInfo) => {
    const { session, close } = createSession(provider)
    try {
      session.bootstrap({ path: 'pages/index/index', query: {}, scene: 1047, referrerInfo })
      expect(session.getLaunchOptions().referrerInfo).toStrictEqual(referrerInfo)
      expect(session.getEnterOptions().referrerInfo).toStrictEqual(referrerInfo)
      const snapshots = session.getApp()!.captureOptions()
      expect(snapshots.launch.referrerInfo).toEqual(referrerInfo)
      expect(snapshots.enter.referrerInfo).toEqual(referrerInfo)
    }
    finally {
      close()
    }
  })
})
