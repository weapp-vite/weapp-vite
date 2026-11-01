import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared/platforms/runtime'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

type ListenerKey = 'error' | 'rejection' | 'theme' | 'audio'
type ListenerSnapshot = Record<ListenerKey, { active: number, added: number, removed: number }>

interface LifecycleSnapshot {
  errors: string[]
  rejections: Array<{ reason: unknown, promiseMatches: boolean, reasonMatches: boolean }>
  themes: string[]
}

interface AudioSnapshot {
  events: string[]
  errors: Array<{ errCode: number, errMsg: string }>
  currentTime: number
  duration: number
  buffered: number
  paused: boolean
  destroyed: boolean
  srcEmpty: boolean
}

interface NativeAudioSnapshot {
  currentTime: number
  duration: number
  paused: boolean
  ended: boolean
  networkState: number
  readyState: number
  error: { code: number, message: string } | null
}

const ROOT = '[data-weapp-page-active="true"]'

describe('issue #1250: compiled Web lifecycle API consumers', { concurrent: false }, () => {
  let project: string | undefined
  let server: PreviewServer | undefined
  let browser: Browser | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    project = await createIssueRegressionProject(1250)
    await buildIssueRegressionProject(project)
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ headless: true, channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    page = await browser!.newPage({ colorScheme: 'light' })
    errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      const add = EventTarget.prototype.addEventListener
      const remove = EventTarget.prototype.removeEventListener
      let unhandledCount = 0
      let currentAudio: HTMLAudioElement | undefined
      // 这些是主动派发的真实 Window 事件，阻止浏览器将其作为未处理故障上报。
      add.call(window, 'error', event => event.preventDefault(), true)
      add.call(window, 'unhandledrejection', (event) => {
        unhandledCount += 1
        event.preventDefault()
      }, true)
      const counters = {
        error: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
        rejection: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
        theme: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
        audio: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
      }
      function key(target: EventTarget, type: string): keyof typeof counters | undefined {
        if (target === window && type === 'error') {
          return 'error'
        }
        if (target === window && type === 'unhandledrejection') {
          return 'rejection'
        }
        if (target instanceof MediaQueryList && type === 'change' && target.media === '(prefers-color-scheme: dark)') {
          return 'theme'
        }
        if (target instanceof HTMLAudioElement) {
          currentAudio = target
          return 'audio'
        }
      }
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        const entry = key(this, type)
        if (entry && listener) {
          counters[entry].added += 1
          counters[entry].active.add(listener)
        }
        return add.call(this, type, listener, options)
      }
      EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const entry = key(this, type)
        if (entry && listener) {
          counters[entry].removed += 1
          counters[entry].active.delete(listener)
        }
        return remove.call(this, type, listener, options)
      }
      Object.defineProperty(window, '__issue1250NativeListeners', {
        value: () => Object.fromEntries(Object.entries(counters).map(([name, counter]) => [name, {
          active: counter.active.size,
          added: counter.added,
          removed: counter.removed,
        }])),
      })
      Object.defineProperty(window, '__issue1250UnhandledCount', { value: () => unhandledCount })
      Object.defineProperty(window, '__issue1250NativeAudio', {
        value: () => currentAudio
          ? {
              currentTime: currentAudio.currentTime,
              duration: currentAudio.duration,
              paused: currentAudio.paused,
              ended: currentAudio.ended,
              networkState: currentAudio.networkState,
              readyState: currentAudio.readyState,
              error: currentAudio.error ? { code: currentAudio.error.code, message: currentAudio.error.message } : null,
            }
          : undefined,
      })
    })
    await page.goto(server!.resolvedUrls!.local[0])
    await expect.poll(() => page.locator(`${ROOT} #ready`).textContent()).toBe('ready')
  })

  afterEach(async () => {
    try {
      expect(errors).toEqual([])
    }
    finally {
      await page?.close()
    }
  })

  afterAll(async () => {
    try {
      await browser?.close()
    }
    finally {
      try {
        if (server) {
          await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
        }
      }
      finally {
        if (project) {
          await rm(project, { recursive: true, force: true })
        }
      }
    }
  })

  async function snapshot() {
    return JSON.parse(await page.locator(`${ROOT} #snapshot`).textContent() ?? '{}') as LifecycleSnapshot
  }

  async function listeners(): Promise<ListenerSnapshot> {
    return page.evaluate(() => Reflect.get(window, '__issue1250NativeListeners')())
  }

  async function audioSnapshot(): Promise<AudioSnapshot> {
    return JSON.parse(await page.locator(`${ROOT} #audio-snapshot`).textContent() ?? '{}') as AudioSnapshot
  }

  async function nativeAudioSnapshot(): Promise<NativeAudioSnapshot | undefined> {
    return page.evaluate(() => Reflect.get(window, '__issue1250NativeAudio')())
  }

  async function waitForNativeAudio(outcome: 'ended' | 'error') {
    try {
      // 媒体装载、解码和播放使用 Playwright 的统一有限等待，不计入 wx 回调桥接的短轮询。
      await page.waitForFunction((expected) => {
        const state = Reflect.get(window, '__issue1250NativeAudio')() as NativeAudioSnapshot | undefined
        return state && (state.error !== null || (expected === 'ended' && state.ended))
      }, outcome)
    }
    catch (cause) {
      throw new Error(`原生音频未到达 ${outcome}：${JSON.stringify({ native: await nativeAudioSnapshot(), wx: await audioSnapshot() })}`, { cause })
    }
    const state = await nativeAudioSnapshot()
    if (!state) {
      throw new Error('音频实例尚未创建')
    }
    return state
  }

  it('delivers native error strings and original rejection values once, then releases subscriptions', async () => {
    const baseline = await listeners()
    await page.locator(`${ROOT} #reinstall`).click()
    expect(await listeners()).toEqual(baseline)
    await page.locator(`${ROOT} #subscribe`).click()
    await page.locator(`${ROOT} #subscribe`).click()
    const subscribed = await listeners()
    for (const name of ['error', 'rejection', 'theme'] as const) {
      expect(subscribed[name].active).toBe(baseline[name].active + 1)
      expect(subscribed[name].added).toBe(baseline[name].added + 1)
    }
    await page.locator(`${ROOT} #reinstall`).click()
    expect(await listeners()).toEqual(subscribed)
    await page.locator(`${ROOT} #dispatch`).click()
    await expect.poll(snapshot).toEqual({
      errors: ['issue-1250 error stack', 'issue-1250 message only'],
      rejections: [{ reason: { code: 'fixture-reason', nested: { count: 2 } }, promiseMatches: true, reasonMatches: true }],
      themes: [],
    })
    await page.locator(`${ROOT} #unsubscribe`).click()
    const released = await listeners()
    for (const name of ['error', 'rejection', 'theme'] as const) {
      expect(released[name].active).toBe(baseline[name].active)
      expect(released[name].removed).toBe(baseline[name].removed + 1)
    }
    const previous = await snapshot()
    await page.locator(`${ROOT} #dispatch`).click()
    expect(await snapshot()).toEqual(previous)
    await page.locator(`${ROOT} #subscribe`).click()
    await page.locator(`${ROOT} #dispatch`).click()
    await expect.poll(async () => (await snapshot()).errors.length).toBe(4)
    expect((await snapshot()).rejections).toHaveLength(2)
  })

  it('follows real browser color scheme changes and stops after offThemeChange', async () => {
    await page.locator(`${ROOT} #subscribe`).click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(async () => (await snapshot()).themes).toEqual(['dark'])
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(async () => (await snapshot()).themes).toEqual(['dark', 'light'])
    await page.locator(`${ROOT} #unsubscribe`).click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
    expect((await snapshot()).themes).toEqual(['dark', 'light'])
  })

  it('keeps a replacement Toast visible past the cancelled timer and hides it at its own deadline', async () => {
    await page.clock.install()
    await page.locator(`${ROOT} #toast-sequence`).click()
    const toast = page.locator('[data-weapp-web-toast="true"]')
    await expect.poll(() => toast.textContent()).toBe('second toast')
    expect(await toast.getAttribute('hidden')).toBeNull()
    await page.clock.fastForward(150)
    expect(await toast.getAttribute('hidden')).toBeNull()
    expect(await toast.textContent()).toBe('second toast')
    await page.clock.fastForward(1000)
    expect(await toast.getAttribute('hidden')).not.toBeNull()
    await page.locator(`${ROOT} #toast-sequence`).click()
    await page.locator(`${ROOT} #hide-toast`).click()
    expect(await toast.getAttribute('hidden')).not.toBeNull()
  })

  it('executes large byte conversions and complete compatibility objects through compiled business code', async () => {
    await page.locator(`${ROOT} #exercise-apis`).click()
    await expect.poll(async () => JSON.parse(await page.locator(`${ROOT} #api-snapshot`).textContent() || '{}')).toEqual({
      bytes: 512 * 1024,
      encodedLength: 4 * Math.ceil(512 * 1024 / 3),
      matches: true,
      entries: 0,
      namedEntries: 0,
      typedEntries: 0,
      supported: 0,
      observerCalls: 0,
      hasNow: false,
      publicFunctionsMatch: true,
      monitorReturnsVoid: true,
      logState: { logCount: 0, maxLogCount: 0, maxSize: 0, size: 0 },
      calls: ['setKeepScreenOn:ok', 'setEnableDebug:ok'],
      inertCalls: 0,
    })
    expect(await page.evaluate(keys => keys.every(key => Reflect.get(window, key) === Reflect.get(window, 'wx')), getMiniProgramRuntimeGlobalKeys())).toBe(true)
    expect(await page.evaluate(() => Reflect.get(window, '__issue1250UnhandledCount')())).toBe(0)
  })

  it('plays a real generated WAV and preserves pause, seek, stop, unsubscribe and destroy semantics', async () => {
    const baseline = await listeners()
    const click = (name: string) => page.locator(`${ROOT} #audio-${name}`).click()
    await click('play')
    await expect.poll(async () => (await audioSnapshot()).events?.includes('Play')).toBe(true)
    await expect.poll(async () => (await audioSnapshot()).duration).toBeCloseTo(6, 1)
    expect((await audioSnapshot()).errors).toEqual([])
    await click('pause')
    await expect.poll(async () => (await audioSnapshot()).paused).toBe(true)
    await expect.poll(async () => (await audioSnapshot()).events.filter(name => name === 'Pause').length).toBe(1)
    const beforeSeek = (await audioSnapshot()).events.filter(name => name === 'Seeked').length
    await click('seek')
    await expect.poll(async () => (await audioSnapshot()).currentTime).toBeCloseTo(2, 1)
    await expect.poll(async () => (await audioSnapshot()).events.filter(name => name === 'Seeked').length).toBeGreaterThan(beforeSeek)
    await click('resume')
    await expect.poll(async () => (await audioSnapshot()).events.filter(name => name === 'Play').length).toBe(2)
    await click('stop')
    await expect.poll(async () => (await audioSnapshot()).events.includes('Stop')).toBe(true)
    expect((await audioSnapshot()).currentTime).toBe(0)
    expect((await audioSnapshot()).paused).toBe(true)
    expect((await audioSnapshot()).events.filter(name => name === 'Pause')).toHaveLength(1)
    expect((await listeners()).audio.active).toBeGreaterThan(baseline.audio.active)
    await click('unsubscribe')
    const events = (await audioSnapshot()).events
    await click('resume')
    await click('pause')
    expect((await audioSnapshot()).events).toEqual(events)
    await click('destroy')
    await expect.poll(async () => (await listeners()).audio.active).toBe(baseline.audio.active)
    expect(await audioSnapshot()).toMatchObject({ destroyed: true, srcEmpty: true })
    await click('resume')
    expect((await audioSnapshot()).events).toEqual(events)
    expect(await page.evaluate(() => Reflect.get(window, '__issue1250UnhandledCount')())).toBe(0)
  })

  it('receives real ended and decode errors without leaking playback rejections', async () => {
    await page.locator(`${ROOT} #audio-end`).click()
    const ended = await waitForNativeAudio('ended')
    expect(ended).toMatchObject({ ended: true, paused: true, error: null })
    expect(ended.duration).toBeCloseTo(0.35, 2)
    expect(ended.currentTime).toBeCloseTo(ended.duration, 2)
    await expect.poll(audioSnapshot, { message: `wx 回调应反映真实媒体完成状态：${JSON.stringify(ended)}` }).toMatchObject({
      events: expect.arrayContaining(['Play', 'Canplay', 'Ended']),
      errors: [],
      paused: true,
    })
    const completed = await audioSnapshot()
    expect(completed.events.filter(name => name === 'Ended')).toHaveLength(1)
    expect(completed.currentTime).toBeCloseTo(ended.duration, 2)
    expect(completed.duration).toBeCloseTo(ended.duration, 2)
    await page.locator(`${ROOT} #audio-error`).click()
    const invalid = await waitForNativeAudio('error')
    expect(invalid.error).toMatchObject({ code: 4 })
    await expect.poll(async () => (await audioSnapshot()).errors.length).toBe(1)
    expect((await audioSnapshot()).errors[0]).toMatchObject({ errCode: 10004, errMsg: expect.stringContaining('fail') })
    expect(await page.evaluate(() => Reflect.get(window, '__issue1250UnhandledCount')())).toBe(0)
    await page.locator(`${ROOT} #audio-destroy`).click()
    await expect.poll(async () => (await listeners()).audio.active).toBe(0)
  })
})
