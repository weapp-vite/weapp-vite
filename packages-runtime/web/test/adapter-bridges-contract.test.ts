import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBatteryInfoBridge,
  getBatteryInfoSyncBridge,
  vibrateShortBridge,
} from '../src/runtime/polyfill/deviceApi'
import {
  getClipboardDataBridge,
  openCustomerServiceChatBridge,
  scanCodeBridge,
  setClipboardDataBridge,
} from '../src/runtime/polyfill/interactionApi'
import {
  canIUseBridge,
  offNetworkStatusChangeBridge,
  offWindowResizeBridge,
  onNetworkStatusChangeBridge,
  onWindowResizeBridge,
} from '../src/runtime/polyfill/runtimeCapabilityApi'
import {
  clearStorageSyncBridge,
  createFileSystemManagerBridgeApi,
  createVKSessionBridgeApi,
  createWorkerBridgeApi,
  getStorageInfoSyncBridge,
  getStorageSyncBridge,
  removeStorageSyncBridge,
  setStorageSyncBridge,
} from '../src/runtime/polyfill/runtimeInfra'
import {
  getAccountInfoSyncBridge,
  getAppBaseInfoBridge,
  getDeviceInfoBridge,
  getMenuButtonBoundingClientRectBridge,
  getSystemInfoBridge,
  getSystemInfoSyncBridge,
  getWindowInfoBridge,
} from '../src/runtime/polyfill/systemApi'
import {
  hideLoadingBridge,
  showLoadingBridge,
  showToastBridge,
} from '../src/runtime/polyfill/uiFeedback'

const runtime = vi.hoisted(() => ({
  addNetwork: vi.fn(),
  addResize: vi.fn(),
  battery: vi.fn(),
  batterySync: vi.fn(),
  buildMenu: vi.fn((width, height) => ({ width, height })),
  buildWindow: vi.fn(info => ({ info })),
  capability: vi.fn(() => true),
  clearStorage: vi.fn(),
  createFileSystem: vi.fn(() => ({ fileSystem: true })),
  createVk: vi.fn(() => ({ vk: true })),
  createWorker: vi.fn(path => ({ path })),
  dialogs: { prompt: vi.fn() },
  getStorage: vi.fn(key => `value:${key}`),
  loading: undefined as any,
  openUrl: vi.fn(),
  readClipboard: vi.fn(),
  readSystem: vi.fn(() => ({
    brand: 'web',
    model: 'browser',
    platform: 'mac',
    statusBarHeight: 20,
    system: 'macOS',
    windowWidth: 375,
  })),
  removeNetwork: vi.fn(),
  removeResize: vi.fn(),
  removeStorage: vi.fn(),
  resolveAppId: vi.fn(() => 'web:test'),
  resolveMemory: vi.fn(() => 4096),
  resolveOrientation: vi.fn(() => 'portrait'),
  resolveScan: vi.fn(prompt => prompt()),
  resolveTheme: vi.fn(() => 'light'),
  setLoading: vi.fn(),
  setStorage: vi.fn(),
  setToast: vi.fn(),
  toast: undefined as any,
  toastPrefix: vi.fn(() => '[ok] '),
  vibrate: vi.fn(),
  writeClipboard: vi.fn(),
}))

vi.mock('../src/runtime/polyfill/system', () => ({
  buildMenuButtonRect: runtime.buildMenu,
  buildWindowInfoSnapshot: runtime.buildWindow,
  readDeviceMemorySize: runtime.resolveMemory,
  readSystemInfoSnapshot: runtime.readSystem,
  resolveAccountAppId: runtime.resolveAppId,
  resolveDeviceOrientation: runtime.resolveOrientation,
  resolveRuntimeTheme: runtime.resolveTheme,
}))

vi.mock('../src/runtime/polyfill/storage', () => ({
  clearStorageSyncInternal: runtime.clearStorage,
  getStorageInfoSyncInternal: vi.fn(() => ({ keys: ['key'] })),
  getStorageSyncInternal: runtime.getStorage,
  normalizeStorageKey: (key: unknown) => String(key ?? '').trim(),
  removeStorageSyncInternal: runtime.removeStorage,
  setStorageSyncInternal: runtime.setStorage,
}))

vi.mock('../src/runtime/polyfill/fileSystemManager', () => ({ createFileSystemManagerBridge: runtime.createFileSystem }))
vi.mock('../src/runtime/polyfill/vkSession', () => ({ createVkSessionBridge: runtime.createVk }))
vi.mock('../src/runtime/polyfill/worker', () => ({ createWorkerBridge: runtime.createWorker }))
vi.mock('../src/runtime/polyfill/capability', () => ({ checkRuntimeCapability: runtime.capability }))
vi.mock('../src/runtime/polyfill/network', () => ({
  addNetworkStatusCallback: runtime.addNetwork,
  removeNetworkStatusCallback: runtime.removeNetwork,
}))
vi.mock('../src/runtime/polyfill/windowResize', () => ({
  addWindowResizeCallback: runtime.addResize,
  removeWindowResizeCallback: runtime.removeResize,
}))
vi.mock('../src/runtime/polyfill/device', () => ({
  readBatteryInfoSnapshot: runtime.battery,
  readBatteryInfoSyncSnapshot: runtime.batterySync,
  vibrateDevice: runtime.vibrate,
}))
vi.mock('../src/runtime/host', () => ({ openRuntimeUrl: runtime.openUrl }))
vi.mock('../src/runtime/polyfill/interaction', () => ({
  readClipboardData: runtime.readClipboard,
  resolveScanCodeResult: runtime.resolveScan,
  writeClipboardData: runtime.writeClipboard,
}))
vi.mock('../src/runtime/polyfill/ui', () => ({
  getGlobalDialogHandlers: () => runtime.dialogs,
  getLoadingElement: () => runtime.loading,
  getToastElement: () => runtime.toast,
  hideToastElement: vi.fn(),
  resolveToastPrefix: runtime.toastPrefix,
  setLoadingVisible: runtime.setLoading,
  setToastVisible: runtime.setToast,
}))

describe('runtime adapter bridges', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    runtime.loading = undefined
    runtime.toast = undefined
    runtime.readSystem.mockReturnValue({
      brand: 'web',
      model: 'browser',
      platform: 'mac',
      statusBarHeight: 20,
      system: 'macOS',
      windowWidth: 375,
    })
  })

  it('bridges system snapshots and async failures', async () => {
    expect(getSystemInfoSyncBridge()).toMatchObject({ platform: 'mac' })
    await expect(getSystemInfoBridge()).resolves.toMatchObject({ errMsg: 'getSystemInfo:ok' })
    expect(getWindowInfoBridge()).toEqual({ info: expect.objectContaining({ platform: 'mac' }) })
    expect(getDeviceInfoBridge()).toMatchObject({ memorySize: 4096, deviceOrientation: 'portrait' })
    expect(getAccountInfoSyncBridge().miniProgram.appId).toBe('web:test')

    vi.stubGlobal('navigator', { appVersion: '1.0', language: 'zh-CN', userAgent: 'agent' })
    expect(getAppBaseInfoBridge()).toMatchObject({ language: 'zh-CN', version: '1.0' })
    vi.stubGlobal('navigator', { language: undefined, userAgent: 'agent' })
    expect(getAppBaseInfoBridge()).toMatchObject({ language: 'en', version: 'agent' })
    vi.stubGlobal('navigator', undefined)
    expect(getAppBaseInfoBridge()).toMatchObject({ language: 'en', version: 'web' })
    expect(getMenuButtonBoundingClientRectBridge()).toEqual({ width: 375, height: 20 })

    runtime.readSystem.mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    await expect(getSystemInfoBridge()).rejects.toMatchObject({ errMsg: 'getSystemInfo:fail blocked' })
    runtime.readSystem.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容边界。
      throw 'blocked value'
    })
    await expect(getSystemInfoBridge()).rejects.toMatchObject({ errMsg: 'getSystemInfo:fail blocked value' })
  })

  it('validates sync storage keys and delegates infrastructure factories', () => {
    expect(() => setStorageSyncBridge('', 1)).toThrow('invalid key')
    expect(() => getStorageSyncBridge(' ')).toThrow('invalid key')
    expect(() => removeStorageSyncBridge(null as any)).toThrow('invalid key')
    setStorageSyncBridge(' key ', 1)
    expect(getStorageSyncBridge(' key ')).toBe('value:key')
    removeStorageSyncBridge(' key ')
    clearStorageSyncBridge()
    expect(getStorageInfoSyncBridge()).toEqual({ keys: ['key'] })
    expect(createFileSystemManagerBridgeApi('success', 'failure')).toEqual({ fileSystem: true })
    expect(createWorkerBridgeApi('worker.js')).toEqual({ path: 'worker.js' })
    expect(createVKSessionBridgeApi()).toEqual({ vk: true })
  })

  it('filters capability listeners and forwards removal and schema checks', () => {
    onNetworkStatusChangeBridge(null)
    onNetworkStatusChangeBridge('invalid')
    const network = vi.fn()
    onNetworkStatusChangeBridge(network)
    expect(runtime.addNetwork).toHaveBeenCalledWith(network)
    offNetworkStatusChangeBridge()

    const getWindowInfo = vi.fn()
    onWindowResizeBridge(undefined, getWindowInfo)
    const resize = vi.fn()
    onWindowResizeBridge(resize, getWindowInfo)
    expect(runtime.addResize).toHaveBeenCalledWith(resize, getWindowInfo)
    offWindowResizeBridge(resize)
    expect(canIUseBridge({ api: true }, 'api')).toBe(true)
  })

  it('normalizes device bridge success and failure values', async () => {
    runtime.batterySync.mockReturnValue({ level: 80 })
    runtime.battery.mockResolvedValue({ level: 90 })
    expect(getBatteryInfoSyncBridge()).toEqual({ level: 80 })
    await expect(getBatteryInfoBridge()).resolves.toMatchObject({ errMsg: 'getBatteryInfo:ok', level: 90 })
    await expect(vibrateShortBridge({ type: 'heavy' })).resolves.toMatchObject({ errMsg: 'vibrateShort:ok' })
    expect(runtime.vibrate).toHaveBeenCalledWith('heavy')

    runtime.vibrate.mockImplementationOnce(() => {
      throw new Error('denied')
    })
    await expect(vibrateShortBridge()).rejects.toMatchObject({ errMsg: 'vibrateShort:fail denied' })
    runtime.vibrate.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容边界。
      throw 'denied value'
    })
    await expect(vibrateShortBridge()).rejects.toMatchObject({ errMsg: 'vibrateShort:fail denied value' })
    runtime.battery.mockRejectedValueOnce(new Error('battery denied'))
    await expect(getBatteryInfoBridge()).rejects.toMatchObject({ errMsg: 'getBatteryInfo:fail battery denied' })
    runtime.battery.mockRejectedValueOnce('battery value')
    await expect(getBatteryInfoBridge()).rejects.toMatchObject({ errMsg: 'getBatteryInfo:fail battery value' })
  })

  it('bridges dialogs, clipboard and customer service failures', async () => {
    await expect(openCustomerServiceChatBridge()).resolves.toMatchObject({ errMsg: 'openCustomerServiceChat:ok' })
    await openCustomerServiceChatBridge({ url: ' https://example.com ' })
    expect(runtime.openUrl).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    runtime.openUrl.mockImplementationOnce(() => {
      throw new Error('popup blocked')
    })
    await expect(openCustomerServiceChatBridge({ url: 'https://example.com' })).resolves.toBeDefined()

    runtime.dialogs.prompt.mockReturnValueOnce(null)
    await expect(scanCodeBridge()).rejects.toMatchObject({ errMsg: 'scanCode:fail cancel' })
    runtime.dialogs.prompt.mockReturnValueOnce('scan-result')
    await expect(scanCodeBridge()).resolves.toMatchObject({ result: 'scan-result' })

    runtime.writeClipboard.mockResolvedValue(undefined)
    await expect(setClipboardDataBridge({ data: null })).resolves.toMatchObject({ errMsg: 'setClipboardData:ok' })
    runtime.writeClipboard.mockRejectedValueOnce(new Error('write denied'))
    await expect(setClipboardDataBridge()).rejects.toMatchObject({ errMsg: 'setClipboardData:fail write denied' })
    runtime.writeClipboard.mockRejectedValueOnce('write value')
    await expect(setClipboardDataBridge()).rejects.toMatchObject({ errMsg: 'setClipboardData:fail write value' })

    runtime.readClipboard.mockResolvedValueOnce('clipboard')
    await expect(getClipboardDataBridge()).resolves.toMatchObject({ data: 'clipboard' })
    runtime.readClipboard.mockRejectedValueOnce(new Error('read denied'))
    await expect(getClipboardDataBridge()).rejects.toMatchObject({ errMsg: 'getClipboardData:fail read denied' })
    runtime.readClipboard.mockRejectedValueOnce('read value')
    await expect(getClipboardDataBridge()).rejects.toMatchObject({ errMsg: 'getClipboardData:fail read value' })
  })

  it('coordinates toast and loading host elements across repeated calls', async () => {
    vi.useFakeTimers()
    await expect(showToastBridge()).resolves.toMatchObject({ errMsg: 'showToast:ok' })
    runtime.toast = { textContent: '' }
    await showToastBridge({ duration: 10, icon: 'success', title: ' Saved ' })
    await showToastBridge({ duration: 20, title: '' })
    expect(runtime.setToast).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(20)

    await expect(showLoadingBridge()).resolves.toMatchObject({ errMsg: 'showLoading:ok' })
    runtime.loading = { textContent: null }
    await showLoadingBridge({ mask: true, title: ' Ready ' })
    await showLoadingBridge({ title: ' ' })
    expect(runtime.setLoading).toHaveBeenCalledWith(runtime.loading, true, '加载中', false)
    await hideLoadingBridge()
    expect(runtime.setLoading).toHaveBeenLastCalledWith(runtime.loading, false, '', false)
    runtime.loading = undefined
    await expect(hideLoadingBridge()).resolves.toMatchObject({ errMsg: 'hideLoading:ok' })
  })
})
