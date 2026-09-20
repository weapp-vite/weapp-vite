import type { DomNodeExpectation } from '../domAcceptance/types'

export const RETAIL_CHECKOUT_GOODS = [{
  quantity: 1,
  storeId: '1000',
  uid: 'u1000',
  saasId: 's1000',
  spuId: 'spu1000',
  title: '测试商品',
  goodsName: '测试商品',
  skuId: 'sku1000',
  storeName: '测试门店',
  roomId: 'r1000',
  price: '12900',
  originPrice: '13900',
  primaryImage: 'https://tdesign.gtimg.com/miniprogram/template/retail/goods/nz-09a.png',
  specInfo: [{ specValue: '白色' }],
}]

export const RETAIL_CHECKOUT_ROUTE = '/pages/order/order-confirm/index'

export function retailCheckoutNodes(quantity: 1 | 2 = 1): DomNodeExpectation[] {
  return [
    { selector: '.submit-btn', text: '提交订单' },
    { selector: '.pay-remark', text: '选填，建议先和商家沟通确认' },
    { selector: '.goods-title', text: '测试商品' },
    { selector: '.goods-num', text: quantity === 1 ? 'x1' : 'x2' },
    { selector: '.order-num', text: quantity === 1 ? '共1件' : '共2件' },
    { selector: '//*[contains(concat(" ", @class, " "), " goods-right ")]//*[contains(concat(" ", @class, " "), " integer ")]', query: 'xpath', text: '129' },
    { selector: '//*[contains(concat(" ", @class, " "), " goods-right ")]//*[contains(concat(" ", @class, " "), " decimal ")]', query: 'xpath', text: '.00' },
    { selector: '//*[contains(concat(" ", @class, " "), " pay-amount ")]//*[contains(concat(" ", @class, " "), " integer ")]', query: 'xpath', text: quantity === 1 ? '118' : '247' },
    { selector: '//*[contains(concat(" ", @class, " "), " pay-amount ")]//*[contains(concat(" ", @class, " "), " decimal ")]', query: 'xpath', count: 0 },
  ]
}
