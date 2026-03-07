import { WEAPI_WX_METHODS } from '@/core/apiCatalog'
import {
  generateApiSupportCoverageReport,
  generateMethodCompatibilityMatrix,
} from '@/core/methodMapping'
import { createWeapi } from '@/index'

export function registerWeapiIndexDouyinResultMappingAndCoverageTests() {
  const douyinPromiseCases = [
    {
      name: 'chooseImage tempFilePaths string to array',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({ tempFilePaths: '/tmp/demo.png' })
        },
      }),
      invoke: (api: any) => api.chooseImage(),
      expectedResult: {
        tempFilePaths: ['/tmp/demo.png'],
      },
    },
    {
      name: 'chooseImage tempFiles fallback to tempFilePaths',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({
            tempFiles: [{ path: '/tmp/a.png' }, { filePath: '/tmp/b.png' }],
          })
        },
      }),
      invoke: (api: any) => api.chooseImage(),
      expectedResult: {
        tempFilePaths: ['/tmp/a.png', '/tmp/b.png'],
      },
    },
    {
      name: 'saveFile filePath fallback to savedFilePath',
      createAdapter: () => ({
        saveFile(options: any) {
          options.success?.({ filePath: 'ttfile://user/demo.png' })
        },
      }),
      invoke: (api: any) => api.saveFile({ tempFilePath: '/tmp/demo.png' }),
      expectedResult: {
        filePath: 'ttfile://user/demo.png',
        savedFilePath: 'ttfile://user/demo.png',
      },
    },
  ]

  it.each(douyinPromiseCases)('maps douyin $name in promise mode', async ({
    createAdapter,
    expectedResult,
    invoke,
  }) => {
    const api = createWeapi({
      adapter: createAdapter(),
      platform: 'tt',
    })

    const result = await invoke(api)
    expect(result).toMatchObject(expectedResult)
  })

  const douyinCallbackCases = [
    {
      name: 'showActionSheet',
      createAdapter: () => ({
        showActionSheet(options: any) {
          options.success?.({ index: 2 })
          options.complete?.({ index: 3 })
          return { index: 4 }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.showActionSheet({
        itemList: ['A', 'B'],
        ...handlers,
      }),
      expectedSuccess: {
        index: 2,
        tapIndex: 2,
      },
      expectedComplete: {
        index: 3,
        tapIndex: 3,
      },
      expectedResult: {
        index: 4,
        tapIndex: 4,
      },
    },
    {
      name: 'chooseImage',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({ tempFiles: [{ path: '/tmp/a.png' }] })
          options.complete?.({ tempFilePaths: '/tmp/b.png' })
          return { tempFilePaths: '/tmp/c.png' }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.chooseImage(handlers),
      expectedSuccess: {
        tempFilePaths: ['/tmp/a.png'],
      },
      expectedComplete: {
        tempFilePaths: ['/tmp/b.png'],
      },
      expectedResult: {
        tempFilePaths: ['/tmp/c.png'],
      },
    },
    {
      name: 'saveFile',
      createAdapter: () => ({
        saveFile(options: any) {
          options.success?.({ filePath: 'ttfile://user/success.png' })
          options.complete?.({ filePath: 'ttfile://user/complete.png' })
          return { filePath: 'ttfile://user/return.png' }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.saveFile({
        tempFilePath: '/tmp/demo.png',
        ...handlers,
      }),
      expectedSuccess: {
        filePath: 'ttfile://user/success.png',
        savedFilePath: 'ttfile://user/success.png',
      },
      expectedComplete: {
        filePath: 'ttfile://user/complete.png',
        savedFilePath: 'ttfile://user/complete.png',
      },
      expectedResult: {
        filePath: 'ttfile://user/return.png',
        savedFilePath: 'ttfile://user/return.png',
      },
    },
  ]

  it.each(douyinCallbackCases)('maps douyin $name callback success and complete', ({
    createAdapter,
    expectedComplete,
    expectedResult,
    expectedSuccess,
    invoke,
  }) => {
    const success = vi.fn()
    const complete = vi.fn()
    const api = createWeapi({
      adapter: createAdapter(),
      platform: 'tt',
    })

    const result = invoke(api, { success, complete })

    expect(success).toHaveBeenCalledWith(expect.objectContaining(expectedSuccess))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining(expectedComplete))
    expect(result).toMatchObject(expectedResult)
  })

  it('generates api coverage report from mapping matrix', () => {
    const report = generateApiSupportCoverageReport()
    const compatibilityMatrix = generateMethodCompatibilityMatrix()
    const wxTotal = WEAPI_WX_METHODS.length
    const alipaySupported = compatibilityMatrix.filter(item => item.alipaySupported).length
    const alipaySemanticAligned = compatibilityMatrix.filter(item => item.alipaySemanticallyAligned).length
    const alipayFallback = compatibilityMatrix.filter(item => item.alipaySupportLevel === 'fallback').length
    const douyinSupported = compatibilityMatrix.filter(item => item.douyinSupported).length
    const douyinSemanticAligned = compatibilityMatrix.filter(item => item.douyinSemanticallyAligned).length
    const douyinFallback = compatibilityMatrix.filter(item => item.douyinSupportLevel === 'fallback').length
    const fullyAligned = compatibilityMatrix.filter(item => item.alipaySupported && item.douyinSupported).length
    const fullySemanticAligned = compatibilityMatrix.filter(item => item.alipaySemanticallyAligned && item.douyinSemanticallyAligned).length
    const formatCoverage = (supported: number) => `${((supported / wxTotal) * 100).toFixed(2)}%`
    expect(report.totalApis).toBe(wxTotal)
    expect(report.fullyAlignedApis).toBe(fullyAligned)
    expect(report.fullyAlignedCoverage).toBe(formatCoverage(fullyAligned))
    expect(report.fullySemanticallyAlignedApis).toBe(fullySemanticAligned)
    expect(report.fullySemanticallyAlignedCoverage).toBe(formatCoverage(fullySemanticAligned))
    expect(report.platforms).toEqual([
      {
        platform: '微信小程序',
        alias: 'wx',
        supportedApis: wxTotal,
        semanticAlignedApis: wxTotal,
        fallbackApis: 0,
        totalApis: wxTotal,
        coverage: '100.00%',
        semanticCoverage: '100.00%',
      },
      {
        platform: '支付宝小程序',
        alias: 'my',
        supportedApis: alipaySupported,
        semanticAlignedApis: alipaySemanticAligned,
        fallbackApis: alipayFallback,
        totalApis: wxTotal,
        coverage: formatCoverage(alipaySupported),
        semanticCoverage: formatCoverage(alipaySemanticAligned),
      },
      {
        platform: '抖音小程序',
        alias: 'tt',
        supportedApis: douyinSupported,
        semanticAlignedApis: douyinSemanticAligned,
        fallbackApis: douyinFallback,
        totalApis: wxTotal,
        coverage: formatCoverage(douyinSupported),
        semanticCoverage: formatCoverage(douyinSemanticAligned),
      },
    ])
  })
}
