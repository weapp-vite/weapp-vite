import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { buildClassStyleComputedCode } from '../transform/classStyleComputed'
import { compileVueTemplateToWxml } from './template'

describe.each(['array', 'object'] as const)('nested key projection source scopes: %s', (sourceKind) => {
  function collection<T>(items: T[]): T[] | Record<string, T> {
    return sourceKind === 'array' ? items : Object.fromEntries(items.map((item, index) => [`entry-${index}`, item]))
  }

  it.each([false, true])('reads original items across empty, populated and replaced lists; destructured aliases: %s', (destructured) => {
    const storeAlias = destructured ? '{ promotionGoodsList: promotions, storeId }' : 'store'
    const storeKey = destructured ? 'storeId || si' : 'store.storeId || si'
    const promotionAlias = destructured ? '{ goodsPromotionList: entries }' : 'promotion'
    const promotionSource = destructured ? 'promotions' : 'store.promotionGoodsList'
    const goodsSource = destructured ? 'entries' : 'promotion.goodsPromotionList'
    const storeParameters = sourceKind === 'object' ? `${storeAlias}, storeName, si` : `${storeAlias}, si`
    const promotionParameters = sourceKind === 'object' ? `${promotionAlias}, promotionName, pi` : `${promotionAlias}, pi`
    const compiled = compileVueTemplateToWxml(`
<view v-for="(${storeParameters}) in stores" :key="${storeKey}">
  <block v-for="(${promotionParameters}) in ${promotionSource}" :key="pi">
    <view v-for="(goods, gi) in ${goodsSource}" :key="goods.id || gi">
      {{ goods.title }}
    </view>
  </block>
</view>`, 'cart-group.vue')
    const bindings = compiled.classStyleBindings ?? []
    const goodsBinding = bindings.find(binding => binding.exp === 'v-for :key goods.id || gi')
    expect(goodsBinding).toBeDefined()
    const code = buildClassStyleComputedCode(bindings, { unrefName: '__wevuUnref', normalizeClassName: '__wevuNormalizeClass', normalizeStyleName: '__wevuNormalizeStyle' })
    const error = vi.fn()
    const computed = runInNewContext(`(${code})`, {
      __wevuUnref: (value: unknown) => value,
      console: { error, warn: vi.fn() },
    }) as Record<string, (this: Record<string, unknown>) => unknown>
    const store = {
      storeId: 'store-a',
      promotionGoodsList: collection([
        { goodsPromotionList: [{ id: 'goods-a', title: 'First item' }, { id: 'goods-b', title: 'Second item' }] },
        { goodsPromotionList: [{ id: 'goods-c', title: 'Third item' }] },
      ]),
    }
    const context = { $state: { stores: collection([store]) }, __wevuProps: {}, stores: collection<typeof store>([]) }
    const evaluate = () => computed[goodsBinding!.name]!.call(context)

    expect(evaluate()).toEqual(collection([]))
    expect(error).not.toHaveBeenCalled()

    context.stores = collection([store])
    const original = structuredClone(context.stores)
    const result = evaluate()

    const expected = [[{ id: 'goods-a', title: 'First item' }, { id: 'goods-b', title: 'Second item' }], [{ id: 'goods-c', title: 'Third item' }]]
    expect(error).not.toHaveBeenCalled()
    expect(result).toMatchObject(collection([collection(expected)]))
    expect(context.stores).toEqual(original)

    const replacement = { storeId: 'store-b', promotionGoodsList: collection([{ goodsPromotionList: [{ id: 'goods-d', title: 'Replacement item' }] }]) }
    context.stores = collection([replacement])
    expect(evaluate()).toMatchObject(collection([collection([[{ id: 'goods-d', title: 'Replacement item' }]])]))
    expect(error).not.toHaveBeenCalled()

    replacement.promotionGoodsList = collection([])
    expect(evaluate()).toEqual(collection([collection([])]))
    context.stores = collection([])
    expect(evaluate()).toEqual(collection([]))
    expect(error).not.toHaveBeenCalled()
  })
})

describe('adjacent key projection source scopes', () => {
  it('reads original items when both adjacent loops are projected', () => {
    const compiled = compileVueTemplateToWxml(`
<view v-for="(store, si) in stores" :key="store.storeId || si">
  <view v-for="(goods, gi) in store.goods" :key="goods.id || gi">{{ goods.title }}</view>
</view>`, 'adjacent-key-projections.vue')
    const bindings = compiled.classStyleBindings ?? []
    const goodsBinding = bindings.find(binding => binding.exp === 'v-for :key goods.id || gi')
    expect(goodsBinding).toBeDefined()
    const code = buildClassStyleComputedCode(bindings, { unrefName: '__wevuUnref', normalizeClassName: '__wevuNormalizeClass', normalizeStyleName: '__wevuNormalizeStyle' })
    const error = vi.fn()
    const computed = runInNewContext(`(${code})`, {
      __wevuUnref: (value: unknown) => value,
      console: { error, warn: vi.fn() },
    }) as Record<string, (this: Record<string, unknown>) => unknown>
    const stores = [{ storeId: 'store-a', goods: [{ id: 'goods-a', title: 'First item' }] }]

    const result = computed[goodsBinding!.name]!.call({ $state: { stores }, __wevuProps: {}, stores })

    expect(error).not.toHaveBeenCalled()
    expect(result).toMatchObject([[{ id: 'goods-a', title: 'First item' }]])
  })
})
