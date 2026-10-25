import { describe, expect, it, vi } from 'vitest'
import { createRetailParityHomeGoods, prepareRetailParityHome } from './retailParityHome'

function createPage(render: 'updated' | 'stale' | 'wrong-title' | 'wrong-middle-title' = 'updated') {
  const natural = Array.from({ length: 20 }, (_, index) => ({ title: `自然商品${index}` }))
  const state: Record<string, unknown> = { goodsList: natural, goodsListLoadStatus: 0, pageLoading: false }
  let rendered = natural.map(item => item.title)
  const page = {
    data: vi.fn(async (key: string) => state[key]),
    setData: vi.fn(async (data: Record<string, unknown>) => {
      Object.assign(state, data)
      if (render !== 'stale') {
        rendered = (data.goodsList as Array<{ title: string }>).map(item => item.title)
      }
      if (render === 'wrong-title') {
        rendered[rendered.length - 1] = '旧末项'
      }
      if (render === 'wrong-middle-title') {
        rendered[1] = '旧中间项'
      }
    }),
    $$: vi.fn(async () => []),
    getElementsByXpath: vi.fn(async () => rendered.map(title => ({ text: async () => title }))),
    waitFor: vi.fn(async () => {}),
  }
  return { page, state, natural }
}

describe('retail parity common home input', () => {
  it('creates isolated four-card inputs with the original first checkpoint title', () => {
    const first = createRetailParityHomeGoods()
    const second = createRetailParityHomeGoods()
    expect(first).toHaveLength(4)
    expect(first[0]!.title).toBe('白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙')
    first[0]!.tags.push('mutated')
    expect(second[0]!.tags).toEqual(['精选'])
  })

  it('saves natural loaded data and complete document before preparing and observing four real nodes', async () => {
    const { page, natural } = createPage()
    const order: string[] = []
    const originalSetData = page.setData.getMockImplementation()!
    page.setData.mockImplementation(async (data) => {
      order.push('setData')
      await originalSetData(data)
    })
    const recordNatural = vi.fn(async () => {
      order.push('saved-natural')
    })
    const captureNatural = vi.fn(async () => ({ roots: ['<view>natural</view>', '<tab-bar/>'], rawWxml: '<view>natural</view><tab-bar/>' }))

    const result = await prepareRetailParityHome({ page, captureNatural, recordNatural, timeoutMs: 0 })

    expect(order).toEqual(['saved-natural', 'setData'])
    expect(recordNatural).toHaveBeenCalledExactlyOnceWith({
      goodsList: natural,
      goodsCount: 20,
      goodsListLoadStatus: 0,
      pageLoading: false,
      document: { roots: ['<view>natural</view>', '<tab-bar/>'], rawWxml: '<view>natural</view><tab-bar/>' },
    })
    expect(result.renderedCount).toBe(4)
    expect(result.titles).toEqual(createRetailParityHomeGoods().map(item => item.title))
    expect(page.getElementsByXpath).toHaveBeenCalledExactlyOnceWith('//*[contains(concat(" ", @class, " "), " goods-card__title ")]', { fallback: false, timeout: 1000 })
    expect(page.$$).not.toHaveBeenCalled()
    expect(page.setData).toHaveBeenCalledTimes(1)
  })

  it.each([
    { goodsList: [], goodsListLoadStatus: 0, pageLoading: false },
    { goodsList: [{ title: 'loaded' }], goodsListLoadStatus: 1, pageLoading: false },
    { goodsList: [{ title: 'loaded' }], goodsListLoadStatus: null, pageLoading: false },
    { goodsList: [{ title: 'loaded' }], goodsListLoadStatus: '', pageLoading: false },
    { goodsList: [{ title: 'loaded' }], goodsListLoadStatus: 0, pageLoading: true },
  ])('does not hide unsuccessful natural loading with a setData override: %j', async (invalid) => {
    const { page, state } = createPage()
    Object.assign(state, invalid)
    const recordNatural = vi.fn(async () => {})
    await expect(prepareRetailParityHome({ page, captureNatural: async () => ({}), recordNatural, timeoutMs: 0 })).rejects.toThrow('successful natural home loading')
    expect(page.setData).not.toHaveBeenCalled()
    expect(recordNatural).not.toHaveBeenCalled()
  })

  it.each(['stale', 'wrong-title', 'wrong-middle-title'] as const)('rejects %s rendered nodes even when page data was updated', async (render) => {
    const { page } = createPage(render)
    await expect(prepareRetailParityHome({ page, captureNatural: async () => ({}), recordNatural: async () => {}, timeoutMs: 0 })).rejects.toThrow('did not render')
    expect(page.setData).toHaveBeenCalledTimes(1)
  })

  it('does not mutate the page when saving natural evidence fails', async () => {
    const { page } = createPage()
    const error = new Error('evidence write failed')
    await expect(prepareRetailParityHome({
      page,
      captureNatural: async () => ({}),
      recordNatural: async () => {
        throw error
      },
    })).rejects.toBe(error)
    expect(page.setData).not.toHaveBeenCalled()
  })

  it('preserves protocol query failures as failures rather than accepting page data alone', async () => {
    const { page } = createPage()
    const error = new Error('rendered node query failed')
    page.getElementsByXpath.mockRejectedValue(error)
    await expect(prepareRetailParityHome({ page, captureNatural: async () => ({}), recordNatural: async () => {}, timeoutMs: 0 })).rejects.toBe(error)
  })
})
