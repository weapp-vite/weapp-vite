// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { toRelativeImport } from '../src/plugin/path'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { findClosestComposedElement } from '../src/runtime/nativeComponents/formControl'
import { resolveContainingShadowRoot } from '../src/runtime/nativeComponents/helpers'
import { resolveImageModeStyle } from '../src/runtime/nativeComponents/image'
import { createInputEventDetail } from '../src/runtime/nativeComponents/input'
import { resolveMovableNumber } from '../src/runtime/nativeComponents/movable/helpers'
import { resolveVideoDirection } from '../src/runtime/nativeComponents/video/helpers'
import { $emit, $off, $on, $once } from '../src/runtime/polyfill/eventBus'
import { readImageInfoFromSource } from '../src/runtime/polyfill/mediaInfo'
import { AppLifecycleRuntime } from '../src/runtime/polyfill/routeRuntime/appLifecycle'
import {
  configureWebRouting,
  disposeWebRouting,
  readWebRouteTarget,
} from '../src/runtime/polyfill/routeRuntime/history'
import { removeStorageBridge, setStorageBridge } from '../src/runtime/polyfill/storageAsync'
import { readSystemInfoSnapshot, resolvePlatformName } from '../src/runtime/polyfill/system'
import { getWebViewportWidth } from '../src/runtime/viewport'
import { normalizeWebTabBarConfig } from '../src/shared/tabBar'

describe('final Web runtime branch contracts', () => {
  beforeAll(() => ensureNativeComponentsDefined())

  afterEach(() => {
    vi.unstubAllGlobals()
    $off()
    disposeWebRouting()
    resetWebRuntimeHost()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('covers direct normalization fallbacks', () => {
    expect(toRelativeImport('/project/index.ts', '/project')).toBe('project')
    expect(resolveImageModeStyle(null)).toEqual({ fit: 'fill', position: 'center' })
    expect(createInputEventDetail({ value: 'text', selectionStart: null })).toEqual({
      value: 'text',
      cursor: 4,
    })
    expect(resolveMovableNumber('invalid', 7)).toBe(7)
    expect(resolveVideoDirection(320, 640)).toBe('vertical')
    expect(resolvePlatformName('', { platform: '' } as Navigator)).toBe('web')
    expect(normalizeWebTabBarConfig({ list: 'invalid' })).toBeUndefined()
  })

  it('uses existing once listeners and preserves unrelated callbacks', () => {
    const persistent = vi.fn()
    const once = vi.fn()
    $on('ready', persistent)
    $once('ready', once)
    $emit('ready', 1)
    $emit('ready', 2)
    expect(persistent).toHaveBeenCalledTimes(2)
    expect(once).toHaveBeenCalledOnce()

    const onceOnly = vi.fn()
    $once('once-only', onceOnly)
    $emit('once-only')
    expect(onceOnly).toHaveBeenCalledOnce()
  })

  it('normalizes non-Error storage and worker failures', async () => {
    setWebRuntimeHost({
      storage: {
        length: 0,
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        removeItem: vi.fn(() => {
          // eslint-disable-next-line no-throw-literal -- 覆盖 Web Storage 宿主抛出字符串的行为。
          throw 'blocked'
        }),
        setItem: vi.fn(() => {
          // eslint-disable-next-line no-throw-literal -- 覆盖 Web Storage 宿主抛出字符串的行为。
          throw 'quota'
        }),
      },
    })
    await expect(setStorageBridge({ key: 'key', data: 1 })).rejects.toMatchObject({
      errMsg: 'setStorage:fail quota',
    })
    await expect(removeStorageBridge({ key: 'key' })).rejects.toMatchObject({
      errMsg: 'removeStorage:fail blocked',
    })
    setWebRuntimeHost({
      storage: {
        length: 0,
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        removeItem: vi.fn(() => {
          throw new Error('denied')
        }),
        setItem: vi.fn(),
      },
    })
    await expect(removeStorageBridge({ key: 'key' })).rejects.toMatchObject({
      errMsg: 'removeStorage:fail denied',
    })

    class ThrowingWorker {
      constructor() {
        // eslint-disable-next-line no-throw-literal -- 覆盖 Worker 构造器抛出非 Error 值的行为。
        throw 'constructor blocked'
      }
    }
    vi.stubGlobal('Worker', ThrowingWorker)
    const { createWorkerBridge } = await import('../src/runtime/polyfill/worker')
    expect(() => createWorkerBridge(null as any)).toThrow('invalid scriptPath')
    expect(() => createWorkerBridge('worker.js')).toThrow('constructor blocked')
  })

  it('reads image dimensions when natural dimensions are unavailable', async () => {
    class WidthOnlyImage {
      height = 45
      onerror?: () => void
      onload?: () => void
      width = 80

      get src() {
        return ''
      }

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', WidthOnlyImage)
    await expect(readImageInfoFromSource('/fallback.png')).resolves.toEqual({ width: 80, height: 45 })

    class DimensionlessImage {
      onerror?: () => void
      onload?: () => void

      get src() {
        return ''
      }

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', DimensionlessImage)
    await expect(readImageInfoFromSource('/dimensionless.png')).resolves.toEqual({ width: 0, height: 0 })
  })

  it('handles empty hash routes and a document without documentElement', () => {
    configureWebRouting({ mode: 'hash' }, ['pages/index/index'], vi.fn())
    expect(readWebRouteTarget(['pages/index/index'], 'https://example.test/#/')).toBeUndefined()

    vi.stubGlobal('document', { querySelector: () => null })
    vi.stubGlobal('window', { innerWidth: 321 })
    expect(getWebViewportWidth()).toBe(321)
  })

  it('crosses shadow roots when locating form owners', () => {
    const form = document.createElement('weapp-form')
    const host = document.createElement('div')
    form.append(host)
    document.body.append(form)
    const shadow = host.attachShadow({ mode: 'open' })
    const input = document.createElement('weapp-input')
    shadow.append(input)
    expect(resolveContainingShadowRoot(input)).toBe(shadow)
    expect(findClosestComposedElement(input, 'weapp-form')).toBe(form)
  })

  it('covers detached form controls and pre-connected rich text', () => {
    const input = document.createElement('weapp-input') as any
    input.formReset()
    const checkbox = document.createElement('weapp-checkbox') as any
    checkbox.formReset()
    checkbox.setCheckedFromGroup(false)
    const toggle = document.createElement('weapp-switch') as any
    toggle.formReset()

    const richText = document.createElement('weapp-rich-text') as any
    richText.nodes = [{ type: 'text', text: 'before connect' }]
    document.body.append(richText)
    expect(richText.shadowRoot!.textContent).toContain('before connect')

    const progress = document.createElement('weapp-progress')
    progress.setAttribute('active', '')
    progress.setAttribute('active-mode', 'forwards')
    progress.setAttribute('duration', '0')
    progress.setAttribute('percent', '20')
    document.body.append(progress)
    expect(progress.style.getPropertyValue('--weapp-progress-percent')).toBe('0%')
  })

  it('ignores labels whose explicit form target is absent', () => {
    const label = document.createElement('weapp-label')
    label.setAttribute('for', 'missing')
    document.body.append(label)
    expect(() => label.click()).not.toThrow()
  })

  it('preserves valid global data when repairing a registered app', () => {
    const runtime = new AppLifecycleRuntime(() => undefined)
    const app = { globalData: null as any }
    runtime.register(app)
    app.globalData = 1
    runtime.register({ globalData: { retained: true } })
    expect(runtime.instance?.globalData).toEqual({ retained: true })
    expect(runtime.register(undefined)).toBeUndefined()
  })

  it('binds resize listeners against globalThis when window is absent', async () => {
    const runtimeWindow = window
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    const addEventListener = vi.spyOn(globalThis, 'addEventListener')
    const { addWindowResizeCallback, removeWindowResizeCallback } = await import('../src/runtime/polyfill/windowResize')
    addWindowResizeCallback(vi.fn(), () => ({ windowWidth: 320, windowHeight: 640 }))
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    removeWindowResizeCallback()
    vi.stubGlobal('window', runtimeWindow)
  })

  it('reads a system snapshot when the window global is absent', () => {
    const runtimeWindow = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    try {
      expect(readSystemInfoSnapshot()).toMatchObject({
        windowHeight: expect.any(Number),
        windowWidth: expect.any(Number),
      })
    }
    finally {
      Object.assign(globalThis, { window: runtimeWindow })
    }
  })
})
