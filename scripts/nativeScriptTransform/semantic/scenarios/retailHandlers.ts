import type { retailFixture } from './fixtures'
import type { Options, ScenarioHost, Values } from './host'
import type { RetailServices } from './retailServices'
import assert from 'node:assert/strict'

export const retailHandlerAssertions = [
  'show-promotion',
  'close-promotion',
  'show-sku-default-type',
  'hide-sku',
  'add-cart-mode',
  'cart-needs-sku',
  'switch-tab-detail-payload',
  'buy-now-mode',
  'choose-spec-detail-payload',
  'change-number-detail-payload',
  'cart-selected-sku',
  'purchase-payload',
  'confirm-purchase-payload',
  'confirm-cart',
  'comment-navigation',
  'promotion-detail-payload',
  'share-result',
  'selected-class',
  'switch-tab-awaits-host',
  'purchase-awaits-host',
  'comments-awaits-host',
  'promotion-awaits-host',
]

export async function observeRetailHandlers(host: ScenarioHost, services: RetailServices, options: Options, ctx: Values, fixture: ReturnType<typeof retailFixture>) {
  const { queue, toasts } = services
  const dispatch = (id: string, detail: unknown = {}) => host.dispatch(options, ctx, id, detail)
  async function settleNavigation(returned: unknown, method: string, label: string) {
    let completed = false
    const completion = Promise.resolve(returned).then(() => {
      completed = true
    })
    await Promise.resolve()
    await Promise.resolve()
    host.check(label, completed, false)
    await queue.resolve(method, { errMsg: `${method}:ok` })
    await completion
  }
  ctx.isShowPromotionPop = false
  dispatch('i0')
  host.check('show-promotion', ctx.isShowPromotionPop, true)
  dispatch('ic')
  host.check('close-promotion', ctx.isShowPromotionPop, false)
  ctx.buyType = 9
  ctx.outOperateStatus = true
  dispatch('i1')
  host.check('show-sku-default-type', host.pick(ctx, ['buyType', 'outOperateStatus', 'isSpuSelectPopupShow']), { buyType: 0, outOperateStatus: false, isSpuSelectPopupShow: true })
  dispatch('i6')
  host.check('hide-sku', ctx.isSpuSelectPopupShow, false)
  dispatch('i3')
  host.check('add-cart-mode', host.pick(ctx, ['buyType', 'outOperateStatus', 'isSpuSelectPopupShow']), { buyType: 2, outOperateStatus: true, isSpuSelectPopupShow: true })
  dispatch('i9')
  host.check('cart-needs-sku', toasts.at(-1), { message: '请选择规格', icon: '', duration: 1000, nativeContextMatches: true })
  const tab = dispatch('i4', { url: '/pages/cart/index' })
  host.check('switch-tab-detail-payload', queue.calls.at(-1), { name: 'switchTab', args: [{ url: '/pages/cart/index' }] })
  await settleNavigation(tab, 'switchTab', 'switch-tab-awaits-host')
  dispatch('i5')
  host.check('buy-now-mode', host.pick(ctx, ['buyType', 'outOperateStatus', 'isSpuSelectPopupShow']), { buyType: 1, outOperateStatus: true, isSpuSelectPopupShow: true })
  dispatch('i7', { specList: fixture.detail.specList, selectedSku: { color: 'red' }, isAllSelectedSku: true })
  host.check('choose-spec-detail-payload', { selected: ctx.isAllSelectedSku, skuId: ctx.selectedSkuItem.skuId, price: ctx.selectSkuSellsPrice, image: ctx.specImg, description: ctx.selectedAttrStr }, { selected: true, skuId: 'sku-red', price: 1250, image: '/images/red.png', description: ' 件，红色' })
  dispatch('i8', { buyNum: 3 })
  host.check('change-number-detail-payload', ctx.buyNum, 3)
  dispatch('i9')
  host.check('cart-selected-sku', toasts.at(-1), { message: '点击加入购物车', icon: '', duration: 1000, nativeContextMatches: true })
  function purchase(label: string) {
    const request = queue.calls.at(-1)!
    assert.equal(request.name, 'navigateTo')
    const url = (request.args[0] as { url: string }).url
    const prefix = '/pages/order/order-confirm/index?goodsRequestList='
    assert(url.startsWith(prefix))
    const payload: unknown = JSON.parse(url.slice(prefix.length))
    host.check(label, { payload, popup: ctx.isSpuSelectPopupShow }, {
      payload: [{ quantity: 3, storeId: '1', goodsName: '语义商品', skuId: 'sku-red', available: 1, price: '1250', specInfo: [{ specTitle: '颜色', specValue: '红色' }], primaryImage: '/images/primary.png', spuId: 'goods-semantic', thumb: '/images/primary.png', title: '语义商品' }],
      popup: false,
    })
  }
  ctx.isSpuSelectPopupShow = true
  const buy = dispatch('ia')
  purchase('purchase-payload')
  await settleNavigation(buy, 'navigateTo', 'purchase-awaits-host')
  ctx.isSpuSelectPopupShow = true
  ctx.buyType = 1
  dispatch('ib')
  purchase('confirm-purchase-payload')
  await queue.resolve('navigateTo', { errMsg: 'navigateTo:ok' })
  ctx.buyType = 2
  const toastCount = toasts.length
  dispatch('ib')
  host.check('confirm-cart', { added: toasts.length - toastCount, message: toasts.at(-1)!.message }, { added: 1, message: '点击加入购物车' })
  const comments = dispatch('i2')
  host.check('comment-navigation', queue.calls.at(-1), { name: 'navigateTo', args: [{ url: '/pages/goods/comments/index?spuId=goods-semantic' }] })
  await settleNavigation(comments, 'navigateTo', 'comments-awaits-host')
  const promotion = dispatch('id', { index: 4 })
  host.check('promotion-detail-payload', queue.calls.at(-1), { name: 'navigateTo', args: [{ url: '/pages/promotion/promotion-detail/index?promotion_id=4' }] })
  await settleNavigation(promotion, 'navigateTo', 'promotion-awaits-host')
  host.check('share-result', host.hooks.get('onShareAppMessage')!(), { imageUrl: '/images/primary.png', title: '语义商品，红色', path: '/pages/goods/details/index?spuId=goods-semantic' })
  host.check('selected-class', options.computed.__wv_cls_0!.call(ctx), '')
}
