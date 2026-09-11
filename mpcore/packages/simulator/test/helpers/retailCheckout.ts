import { RETAIL_CHECKOUT_GOODS } from '../../../../../e2e/utils/templateAcceptance/retailCheckout'

/** 将测试商品转换为 simulator 结算 fixture 所需的商品结构。 */
function toSettlementGoods(goods: (typeof RETAIL_CHECKOUT_GOODS)[number], quantity: number) {
  return {
    storeId: goods.storeId,
    spuId: goods.spuId,
    skuId: goods.skuId,
    goodsName: goods.title,
    quantity,
    payPrice: goods.price,
    settlePrice: goods.price,
  }
}

/** 生成独立于模板源码的 simulator 结算 fixture。 */
export function retailSettlement(quantity: number) {
  const skuDetailVos = RETAIL_CHECKOUT_GOODS.map(goods => toSettlementGoods(goods, quantity))
  const totalPrice = skuDetailVos.reduce((total, goods) => total + goods.quantity * Number(goods.settlePrice), 0)

  return {
    settleType: 0,
    totalGoodsCount: skuDetailVos.reduce((total, goods) => total + goods.quantity, 0),
    totalPayAmount: `${totalPrice - 1100}`,
    storeGoodsList: [{ storeId: '1000', skuDetailVos }],
    inValidGoodsList: null,
    outOfStockGoodsList: null,
  }
}

export const retailCheckoutFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/checkout/index'] })],
  ['app.js', 'App({ cacheSettlement(value) { wx.setStorageSync("retail.settlement", value) } })'],
  ['pages/checkout/index.json', JSON.stringify({ usingComponents: { 'goods-card': '/components/goods-card', 'checkout-status': '/components/status' } })],
  ['pages/checkout/index.js', `Page({
    data: { loading: true, settlement: null },
    onLoad() {
      const settlement = wx.getStorageSync('retail.settlement')
      Promise.resolve().then(() => this.setData({ loading: false, settlement }))
    }
  })`],
  ['pages/checkout/index.wxml', `<view wx:if="{{loading}}" id="loading">结算中</view>
    <view wx:else>
      <view wx:for="{{settlement.storeGoodsList}}" wx:for-item="store" wx:key="storeId">
        <goods-card wx:for="{{store.skuDetailVos}}" wx:key="skuId" goods="{{item}}" />
      </view>
      <text id="quantity">共{{settlement.totalGoodsCount}}件</text>
      <text id="amount">{{settlement.totalPayAmount}}</text>
      <checkout-status invalid="{{settlement.inValidGoodsList}}" unavailable="{{settlement.outOfStockGoodsList}}" />
    </view>`],
  ['components/goods-card.json', JSON.stringify({ component: true })],
  ['components/goods-card.js', 'Component({ properties: { goods: Object } })'],
  ['components/goods-card.wxml', '<view><text class="goods-title">{{goods.goodsName}}</text><text class="goods-count">x{{goods.quantity}}</text><text class="goods-price">{{goods.payPrice}}</text></view>'],
  ['components/status.json', JSON.stringify({ component: true })],
  ['components/status.js', 'Component({ properties: { invalid: { type: null, value: [] }, unavailable: { type: null, value: [] } } })'],
  ['components/status.wxml', '<text wx:if="{{invalid.length || unavailable.length}}" id="blocked">商品不可结算</text><text wx:else id="available">提交订单</text>'],
]
