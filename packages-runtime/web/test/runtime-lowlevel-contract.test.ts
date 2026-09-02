import { WEAPP_VITE_WEB_SCAN_CODE_RESULT_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearVirtualHostClasses,
  clearVirtualHostParts,
  syncVirtualHostClasses,
  syncVirtualHostParts,
} from '../src/runtime/component/virtualHost'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  readBatteryInfoSnapshot,
  readBatteryInfoSyncSnapshot,
  vibrateDevice,
} from '../src/runtime/polyfill/device'
import {
  readClipboardData,
  resolveScanCodeResult,
  writeClipboardData,
} from '../src/runtime/polyfill/interaction'
import { readVideoInfoFromSource } from '../src/runtime/polyfill/mediaInfo'
import { getStorageSyncInternal, removeStorageSyncInternal } from '../src/runtime/polyfill/storage'
import {
  addWindowResizeCallback,
  removeWindowResizeCallback,
} from '../src/runtime/polyfill/windowResize'
import { setupRpx } from '../src/runtime/rpx'

function createAttributeElement(tagName = 'div', attributes: Record<string, string> = {}) {
  const values = new Map(Object.entries(attributes))
  return {
    tagName,
    getAttribute: (name: string) => values.get(name) ?? null,
    removeAttribute: (name: string) => values.delete(name),
    setAttribute: (name: string, value: string) => values.set(name, value),
  }
}

describe('runtime low-level capability contracts', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>)[WEAPP_VITE_WEB_SCAN_CODE_RESULT_KEY]
  })

  it('normalizes vibration durations and battery snapshots', async () => {
    const vibrate = vi.fn((_duration: number) => true)
    vi.stubGlobal('navigator', { vibrate })
    vibrateDevice('heavy')
    vibrateDevice('medium')
    vibrateDevice('light')
    expect(vibrate.mock.calls.map(call => call[0])).toEqual([30, 20, 15])

    vi.stubGlobal('navigator', undefined)
    expect(() => vibrateDevice(undefined)).toThrow('vibrate is unavailable')

    vi.stubGlobal('navigator', {
      getBattery: vi.fn()
        .mockResolvedValueOnce({ charging: true, level: 2 })
        .mockResolvedValueOnce({ charging: false, level: -1 })
        .mockResolvedValueOnce({ level: Number.NaN }),
    })
    await expect(readBatteryInfoSnapshot()).resolves.toEqual({ level: 100, isCharging: true })
    await expect(readBatteryInfoSnapshot()).resolves.toEqual({ level: 0, isCharging: false })
    await expect(readBatteryInfoSnapshot()).resolves.toEqual({ level: 100, isCharging: false })

    vi.stubGlobal('navigator', {})
    await expect(readBatteryInfoSnapshot()).resolves.toEqual({ level: 100, isCharging: false })

    vi.stubGlobal('navigator', { getBattery: vi.fn().mockRejectedValue(new Error('denied')) })
    expect(readBatteryInfoSyncSnapshot()).toEqual({ level: 100, isCharging: false })
    await Promise.resolve()
    await Promise.resolve()
  })

  it('covers scan result coercion and clipboard fallbacks', async () => {
    const runtimeGlobal = globalThis as Record<string, unknown>
    runtimeGlobal[WEAPP_VITE_WEB_SCAN_CODE_RESULT_KEY] = { result: 42 }
    expect(resolveScanCodeResult()).toBe('42')
    runtimeGlobal[WEAPP_VITE_WEB_SCAN_CODE_RESULT_KEY] = {}
    expect(resolveScanCodeResult()).toBe('')
    delete runtimeGlobal[WEAPP_VITE_WEB_SCAN_CODE_RESULT_KEY]
    expect(resolveScanCodeResult(() => null)).toBeNull()

    setWebRuntimeHost({ clipboard: {} as never })
    vi.stubGlobal('document', undefined)
    await expect(writeClipboardData('missing')).rejects.toThrow('Clipboard API is unavailable')
    await expect(readClipboardData()).rejects.toThrow('Clipboard API is unavailable')

    const removeChild = vi.fn()
    const select = vi.fn()
    const textarea = {
      parentNode: { removeChild },
      select,
      setAttribute: vi.fn(),
      value: '',
    }
    const body = { append: vi.fn() }
    const runtimeDocument = {
      body,
      createElement: vi.fn(() => textarea),
    }
    vi.stubGlobal('document', runtimeDocument)
    await expect(writeClipboardData('unsupported')).rejects.toThrow(TypeError)

    Object.assign(runtimeDocument, { execCommand: vi.fn(() => false) })
    await expect(writeClipboardData('denied')).rejects.toThrow('returned false')
    expect(removeChild).toHaveBeenCalledWith(textarea)

    Object.assign(runtimeDocument, { execCommand: vi.fn(() => true) })
    await expect(writeClipboardData('copied')).resolves.toBeUndefined()
    expect(textarea.value).toBe('copied')
    expect(select).toHaveBeenCalled()
  })

  it('synchronizes virtual host tokens across empty and replaced roots', () => {
    const host = createAttributeElement('host', { class: 'caller runtime' })
    const style = createAttributeElement('style')
    const first = createAttributeElement('section', { class: 'root active', part: 'declared old' })
    const ownedClasses = new Set(['runtime'])
    const ownedParts = new Set(['old'])

    syncVirtualHostClasses(host, { childNodes: [{}, style, first] }, ownedClasses)
    expect(host.getAttribute('class')).toBe('caller root active')
    expect(ownedClasses).toEqual(new Set(['root', 'active']))

    const second = createAttributeElement('main', { class: 'next', part: 'manual' })
    expect(syncVirtualHostParts({ childNodes: [second] }, first, ownedParts)).toBe(second)
    expect(first.getAttribute('part')).toBe('declared')
    expect(second.getAttribute('part')).toBe('manual next')

    expect(syncVirtualHostParts({ childNodes: [] }, second, ownedParts)).toBeUndefined()
    expect(second.getAttribute('part')).toBe('manual')
    const retained = createAttributeElement('article', { class: 'shared', part: 'shared' })
    expect(syncVirtualHostParts({ childNodes: [retained] }, undefined, new Set())).toBe(retained)
    expect(retained.getAttribute('part')).toBe('shared')
    clearVirtualHostParts(undefined, ownedParts)
    clearVirtualHostParts(second, new Set())

    clearVirtualHostClasses(host, ownedClasses)
    expect(host.getAttribute('class')).toBe('caller')
    clearVirtualHostClasses(host, ownedClasses)
    syncVirtualHostClasses(host, {}, ownedClasses)
    expect(host.getAttribute('class')).toBe('caller')
    syncVirtualHostClasses(createAttributeElement('empty'), {}, new Set())
  })

  it('handles missing document, media, storage, and repeated resize bridges', async () => {
    vi.stubGlobal('document', undefined)
    expect(() => setupRpx()).not.toThrow()

    vi.stubGlobal('document', { createElement: () => null })
    await expect(readVideoInfoFromSource('/missing.mp4')).rejects.toThrow('video element is unavailable')

    setWebRuntimeHost({
      storage: {
        length: 0,
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      } as any,
    })
    removeStorageSyncInternal('never-cached')
    expect(getStorageSyncInternal('never-cached')).toBe('')

    const addEventListener = vi.fn()
    vi.stubGlobal('window', { addEventListener })
    const first = vi.fn()
    const second = vi.fn()
    const getWindowInfo = () => ({ windowWidth: 320, windowHeight: 640 })
    addWindowResizeCallback(first, getWindowInfo)
    addWindowResizeCallback(second, getWindowInfo)
    expect(addEventListener).toHaveBeenCalledTimes(1)
    removeWindowResizeCallback()
  })
})
