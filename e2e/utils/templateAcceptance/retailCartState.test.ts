import { describe, expect, it } from 'vitest'
import { isRetailCartReady, readRetailCartSnapshot } from './retailCartState'

function stores() {
  return [{
    promotionGoodsList: [{ goodsPromotionList: [{ title: '商品甲' }, { title: '商品乙' }] }],
    shortageGoodsList: [{ title: '缺货商品' }],
  }]
}

function loadedGroup() {
  return { isNotEmpty: true, storeGoods: stores(), invalidGoodItems: [] }
}

const document = { hasCartGroup: true, titles: ['商品甲', '商品乙', '缺货商品'] }

describe('retail cart rendering state', () => {
  it('uses native cartGroupData when no independent rendering bindings exist', () => {
    const snapshot = readRetailCartSnapshot({ cartGroupData: loadedGroup() })
    expect(snapshot).toEqual({ source: 'cart-group', isNotEmpty: true, storeCount: 1, invalidCount: 0, goodsTitles: document.titles })
    expect(isRetailCartReady(snapshot, document)).toBe(true)
  })

  it('uses real rendering bindings while the unused exposed snapshot remains empty', () => {
    const snapshot = readRetailCartSnapshot({
      cartGroupData: { isNotEmpty: false, storeGoods: [], invalidGoodItems: [] },
      cartIsNotEmpty: true,
      cartStoreGoods: stores(),
      cartInvalidGoodItems: [],
    })
    expect(snapshot.source).toBe('render-bindings')
    expect(isRetailCartReady(snapshot, document)).toBe(true)
  })

  it('does not fill empty or missing rendering fields from the stale exposed object', () => {
    const snapshot = readRetailCartSnapshot({
      cartGroupData: { ...loadedGroup(), invalidGoodItems: [{ title: '旧失效商品' }] },
      cartIsNotEmpty: false,
      cartStoreGoods: [],
    })
    expect(snapshot).toEqual({ source: 'render-bindings', isNotEmpty: false, storeCount: 0, invalidCount: null, goodsTitles: [] })
    expect(isRetailCartReady(snapshot, document)).toBe(false)
  })

  it('requires the first displayed title to match its actual rendering data', () => {
    const snapshot = readRetailCartSnapshot({ cartGroupData: loadedGroup() })
    expect(isRetailCartReady(snapshot, { ...document, titles: [] })).toBe(false)
    expect(isRetailCartReady(snapshot, { ...document, titles: ['错误商品'] })).toBe(false)
    // 其余标题留作诊断，不引入全卡数量或顺序相等的新等待契约。
    expect(isRetailCartReady(snapshot, { ...document, titles: ['商品甲'] })).toBe(true)
  })

  it('preserves the original invalid-only nonempty contract without adding a title requirement', () => {
    const snapshot = readRetailCartSnapshot({ cartGroupData: {
      isNotEmpty: false,
      storeGoods: [],
      invalidGoodItems: [{ title: '失效商品' }],
    } })
    expect(isRetailCartReady(snapshot, { hasCartGroup: true, titles: [] })).toBe(true)
    expect(isRetailCartReady(snapshot, { hasCartGroup: false, titles: [] })).toBe(false)
  })

  it('never treats data or document capture errors as ready', () => {
    const snapshot = readRetailCartSnapshot({ cartGroupData: loadedGroup() })
    expect(isRetailCartReady(snapshot, { ...document, dataError: 'data failed' })).toBe(false)
    expect(isRetailCartReady(snapshot, { ...document, wxmlError: 'document failed' })).toBe(false)
  })

  it('rejects missing or malformed product data rather than inventing a displayed title', () => {
    for (const data of [undefined, null, [], { cartGroupData: {} }, {
      cartGroupData: { ...loadedGroup(), storeGoods: [{ promotionGoodsList: [], shortageGoodsList: [{ title: '' }] }] },
    }]) {
      expect(isRetailCartReady(readRetailCartSnapshot(data), document)).toBe(false)
    }
  })
})
