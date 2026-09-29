import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('cancels asynchronous unload work when the browser runtime is destroyed', async () => {
  let pending: Promise<void> | undefined
  const callback = vi.fn()
  const session = createBrowserHeadlessSession({
    globals: {
      observe: (value: Promise<void>) => {
        pending = value
      },
      callback,
    },
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `Page({ onUnload() {
        observe(Promise.resolve().then(() => {
          setTimeout(callback, 0)
          setInterval(callback, 0)
        }))
      } })`],
      ['pages/index/index.wxml', '<view>active</view>'],
    ]),
  })
  session.reLaunch('/pages/index/index')
  session.close()
  expect(pending).toBeDefined()
  await pending
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(callback).not.toHaveBeenCalled()
})

it('closes the browser runtime and cancels queued navigation even when onUnload throws', async () => {
  const unloadError = new Error('browser unload failed')
  const unloaded = vi.fn()
  const targetLoaded = vi.fn()
  const session = createBrowserHeadlessSession({
    globals: { unloadError, unloaded, targetLoaded },
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/target/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `Page({
        queueNavigation() { wx.navigateTo({ url: '/pages/target/index' }) },
        onUnload() { unloaded(); throw unloadError },
      })`],
      ['pages/index/index.wxml', '<view>initial</view>'],
      ['pages/target/index.js', 'Page({ onLoad() { targetLoaded() } })'],
      ['pages/target/index.wxml', '<view>target</view>'],
    ]),
  })
  try {
    session.reLaunch('/pages/index/index').queueNavigation()
    let failure: unknown
    try {
      session.close()
    }
    catch (error) {
      failure = error
    }
    expect(failure).toBe(unloadError)
    expect(session.isClosed).toBe(true)
    expect(() => session.getCurrentPages()).toThrow(/closed/i)
    await Promise.resolve()
    // 使用真实 Chromium 宿主任务边界，确认关闭后没有逃逸到浏览器计时器的导航。
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 0)
    await promise
    expect(targetLoaded).not.toHaveBeenCalled()
    session.close()
    expect(unloaded).toHaveBeenCalledTimes(1)
  }
  finally {
    session.close()
  }
})

it('finishes component cleanup and cancels navigation when the first detached throws', async () => {
  const detachedError = new Error('parent detached failed')
  const laterError = new Error('child detached failed')
  const detached: string[] = []
  const subscriptions = new Set<string>()
  const targetLoaded = vi.fn()
  const navigated = vi.fn()
  const session = createBrowserHeadlessSession({
    globals: {
      detachedError,
      laterError,
      targetLoaded,
      navigated,
      subscribe: (label: string) => subscriptions.add(label),
      release: (label: string) => {
        detached.push(label)
        subscriptions.delete(label)
      },
    },
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/target/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', JSON.stringify({
        usingComponents: { 'relation-parent': '/components/parent', 'relation-child': '/components/child' },
      })],
      ['pages/index/index.js', `Page({
        queueNavigation() { wx.navigateTo({ url: '/pages/target/index', success: navigated }) },
      })`],
      ['pages/index/index.wxml', '<relation-parent id="parent"><relation-child id="child" /></relation-parent>'],
      ['components/parent.json', JSON.stringify({ component: true })],
      ['components/parent.js', `Component({
        relations: { './child': { type: 'descendant' } },
        lifetimes: {
          attached() { subscribe('parent') },
          detached() { release('parent'); throw detachedError },
        },
      })`],
      ['components/parent.wxml', '<view><slot /></view>'],
      ['components/child.json', JSON.stringify({ component: true })],
      ['components/child.js', `Component({
        relations: { './parent': { type: 'ancestor' } },
        lifetimes: {
          attached() { subscribe('child') },
          detached() { release('child'); throw laterError },
        },
      })`],
      ['components/child.wxml', '<view>child</view>'],
      ['pages/target/index.js', 'Page({ onLoad() { targetLoaded() } })'],
      ['pages/target/index.wxml', '<view>target</view>'],
    ]),
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    const parent = page.selectComponent?.('#parent')
    const child = page.selectComponent?.('#child')
    expect(parent.getRelationNodes('./child')).toEqual([child])
    expect(child.getRelationNodes('./parent')).toEqual([parent])
    expect([...subscriptions]).toEqual(['parent', 'child'])
    page.queueNavigation()
    await Promise.resolve()
    let failure: unknown
    try {
      session.close()
    }
    catch (error) {
      failure = error
    }
    expect(failure).toBe(detachedError)
    expect(session.isClosed).toBe(true)
    expect(() => session.getCurrentPages()).toThrow(/closed/i)
    expect(detached).toEqual(['parent', 'child'])
    expect([...subscriptions]).toEqual([])
    expect(parent.getRelationNodes('./child')).toEqual([])
    expect(child.getRelationNodes('./parent')).toEqual([])
    // 跨过真实 Chromium 计时器边界，避免 fake timers 掩盖关闭后逃逸的导航。
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 0)
    await promise
    expect(targetLoaded).not.toHaveBeenCalled()
    expect(navigated).not.toHaveBeenCalled()
    session.close()
    expect(detached).toEqual(['parent', 'child'])
  }
  finally {
    session.close()
  }
})
