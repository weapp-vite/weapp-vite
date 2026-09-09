import { RETAIL_CHECKOUT_GOODS } from '../../../../../e2e/utils/templateAcceptance/retailCheckout'
import { genSettleDetail } from '../../../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/model/order/orderConfirm'

// 使用真实模板的结算响应，最小化宿主的异步数据、nullable 属性和嵌套组件渲染契约。
// 完整 Vue 模板仍由 e2e/ide/template-retail-checkout.runtime.test.ts 双 provider 验收。
export function retailSettlement(quantity: number) {
  return genSettleDetail({ goodsRequestList: RETAIL_CHECKOUT_GOODS.map(item => ({ ...item, quantity })) }).data
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
