import { transformSync } from 'esbuild'
import { describe, expect, it, vi } from 'vitest'
import { generateEntryModule } from '../src/plugin/entry'

describe('generated inline style configuration', () => {
  it.each([
    { options: undefined, expected: { useVariable: true, rpxVar: '--rpx', ratio: 0.5, designWidth: 750 }, rpx: { designWidth: 750 } },
    { options: { pxPerRpx: 0.25 }, expected: { useVariable: false, rpxVar: '--rpx', ratio: 0.25, designWidth: 750 }, rpx: undefined },
    { options: { pxPerRpx: 0.25, designWidth: 375, rpxVar: '--custom-unit' }, expected: { useVariable: true, rpxVar: '--custom-unit', ratio: 0.25, designWidth: 375 }, rpx: { designWidth: 375, varName: '--custom-unit' } },
  ])('passes explicit unit options alongside the existing rpx initializer: $expected', ({ options, expected, rpx }) => {
    const initializePageRoutes = vi.fn()
    const code = generateEntryModule({ pages: [], components: [], layouts: [] }, '', options, { __runtimeProvider: { moduleId: 'test-runtime' } })
    // eslint-disable-next-line no-new-func -- 观察生成入口实际传入的公开初始化参数。
    new Function('require', transformSync(code, { format: 'cjs' }).code)(() => ({ initializePageRoutes }))
    expect(initializePageRoutes).toHaveBeenCalledExactlyOnceWith([], { styleUnits: expected, ...(rpx ? { rpx } : {}) })
  })
})
