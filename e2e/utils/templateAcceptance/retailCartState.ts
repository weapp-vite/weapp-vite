interface RetailCartSnapshot {
  source: 'render-bindings' | 'cart-group' | 'missing'
  isNotEmpty: unknown
  storeCount: number | null
  invalidCount: number | null
  goodsTitles: string[] | null
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function readGoodsTitles(stores: unknown): string[] | null {
  if (!Array.isArray(stores)) {
    return null
  }
  const titles: string[] = []
  for (const value of stores) {
    const store = asRecord(value)
    if (!store || !Array.isArray(store.promotionGoodsList) || !Array.isArray(store.shortageGoodsList)) {
      return null
    }
    const goods: unknown[] = []
    for (const value of store.promotionGoodsList) {
      const promotion = asRecord(value)
      if (!promotion || !Array.isArray(promotion.goodsPromotionList)) {
        return null
      }
      goods.push(...promotion.goodsPromotionList)
    }
    goods.push(...store.shortageGoodsList)
    for (const value of goods) {
      const good = asRecord(value)
      if (!good || typeof good.title !== 'string' || !good.title.trim()) {
        return null
      }
      titles.push(good.title.trim())
    }
  }
  return titles
}

/** 依据实际渲染字段适配购物车，避免读取未参与 setData 的旧暴露快照。 */
export function readRetailCartSnapshot(value: unknown): RetailCartSnapshot {
  const data = asRecord(value)
  const usesBindings = !!data && ['cartStoreGoods', 'cartInvalidGoodItems', 'cartIsNotEmpty']
    .some(key => Object.hasOwn(data, key))
  const group = asRecord(data?.cartGroupData)
  const storeGoods = usesBindings ? data?.cartStoreGoods : group?.storeGoods
  const invalidGoods = usesBindings ? data?.cartInvalidGoodItems : group?.invalidGoodItems
  return {
    source: usesBindings ? 'render-bindings' : group ? 'cart-group' : 'missing',
    isNotEmpty: usesBindings ? data?.cartIsNotEmpty : group?.isNotEmpty,
    storeCount: Array.isArray(storeGoods) ? storeGoods.length : null,
    invalidCount: Array.isArray(invalidGoods) ? invalidGoods.length : null,
    goodsTitles: readGoodsTitles(storeGoods),
  }
}

/** 保留原非空契约，并核对首项实际展示商品；完整标题仅用于诊断。 */
export function isRetailCartReady(snapshot: RetailCartSnapshot, document: {
  hasCartGroup: boolean
  titles: string[]
  dataError?: string
  wxmlError?: string
}) {
  const hasData = (snapshot.storeCount !== null && snapshot.storeCount > 0)
    || (snapshot.invalidCount !== null && snapshot.invalidCount > 0)
  const firstTitle = snapshot.goodsTitles?.[0]
  return hasData && document.hasCartGroup
    && !document.dataError && !document.wxmlError
    && snapshot.goodsTitles !== null
    && (firstTitle === undefined || document.titles[0]?.trim() === firstTitle)
}
