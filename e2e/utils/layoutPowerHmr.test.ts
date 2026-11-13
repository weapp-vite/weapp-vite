import { afterEach, expect, it, vi } from 'vitest'
import { captureLayoutPageState } from '../ide/layoutPowerDom/hmr'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('../ide/layoutPowerDom/session', () => ({ DIST_ROOT: 'dist' }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function fixture(options: { afterEvents?: number, facadePageId?: number } = {}) {
  const nativeData = { currentLayout: 'poster', runtimeEvents: 7, e2eRuntimeVendorMarker: 'baseline' }
  const facadeData = { ...nativeData, runtimeEvents: 5 }
  const nativePage = {
    pageId: 5,
    data: vi.fn()
      .mockResolvedValueOnce(nativeData)
      .mockResolvedValueOnce({ ...nativeData, runtimeEvents: options.afterEvents ?? 7 }),
    callMethodWithOptions: vi.fn(async () => ({ currentLayout: 'poster', marker: 'baseline', definitionMarker: 'updated', ok: false })),
  }
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/index/index', __wxWebviewId__: options.facadePageId ?? 5, data: facadeData }])
  const miniProgram = {
    currentPage: vi.fn(async () => nativePage),
    evaluate: vi.fn(async (callback, ...args) => callback(...args)),
  }
  return { miniProgram, nativePage, nativeData, facadeData }
}

it('retains stale route facade diagnostics while reading the native state after HMR interactions', async () => {
  const { miniProgram, nativePage, nativeData, facadeData } = fixture()
  const result = await captureLayoutPageState(miniProgram, 'after-native-interactions')

  expect(result.nativeState).toEqual({ pageId: 5, before: nativeData, after: nativeData })
  expect(result.state.data).toEqual(facadeData)
  expect(miniProgram.currentPage).toHaveBeenCalledExactlyOnceWith({ appFunctionFallback: false })
  expect(nativePage.data).toHaveBeenCalledTimes(2)
  expect(nativePage.data).toHaveBeenCalledWith(undefined, { fallback: false, timeout: 2_500 })
  expect(nativePage.callMethodWithOptions).toHaveBeenCalledExactlyOnceWith('runE2E', { fallback: false, timeout: 2_500, routeOnly: true })
  expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
    channel: 'hmr-diagnostics',
    text: expect.stringContaining('after-native-interactions'),
  }))
})

it('rejects mutation of native page data by a read-only diagnostic method', async () => {
  const { miniProgram } = fixture({ afterEvents: 6 })
  await expect(captureLayoutPageState(miniProgram, 'changed')).rejects.toThrow('只读方法不能改写原生页面状态')
})

it('rejects a facade for a different native page', async () => {
  const { miniProgram } = fixture({ facadePageId: 6 })
  await expect(captureLayoutPageState(miniProgram, 'different-page')).rejects.toThrow('AppService 与原生协议必须指向同一页面')
})
