import type { DomNodeExpectation } from '../domAcceptance/types'
import type { TemplateDomRoute } from './index'
import { renderedText, templatePage } from './index'

function componentText(selector: string, text: string, marker = selector): DomNodeExpectation {
  return renderedText(selector, text, [{ has: marker }])
}

const filterNodes = [
  componentText('.filter-item:nth-child(1)', '综合', '.filter-wrap'),
  componentText('.filter-item:nth-child(2) text', '价格', '.filter-wrap'),
]

export const RETAIL_TEMPLATE_DOM: TemplateDomRoute[] = [
  templatePage('/pages/home/home', [
    { selector: 'input', scope: [{ has: '.t-search' }], attributes: { placeholder: 'iphone 13 火热发售中' } },
    renderedText('.goods-card__title', '白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙', [{ has: '.goods-list-wrap' }, '#home-goods-list-gd-0']),
  ]),
  templatePage('/pages/category/index', [
    componentText('.goods-category-normal-item-title', '女装', '.goods-category'),
    { selector: '.goods-category-normal-item-container-item', scope: [{ has: '.goods-category' }], count: 11 },
  ]),
  templatePage('/pages/cart/index', [
    componentText('.cart-bar__total--bold.text-padding-right', '总计', '.cart-bar'),
    componentText('.account-btn', '去结算(16)', '.cart-bar'),
  ]),
  templatePage('/pages/usercenter/index', [
    componentText('.order-group__item:nth-child(1) .order-group__item__title', '待付款', '.order-group'),
    { selector: '.order-group__item', scope: [{ has: '.order-group' }], count: 5 },
  ]),
  templatePage('/pages/user/person-info/index', [renderedText('.person-info__btn', '切换账号登录')]),
  templatePage('/pages/user/address/list/index', [renderedText('.address-btn text', '新建收货地址')]),
  templatePage('/pages/user/address/edit/index', [
    { selector: 'input', scope: [{ has: 'input[placeholder="您的姓名"]' }], attributes: { placeholder: '您的姓名', maxlength: '20' } },
    { selector: 'input', scope: [{ has: 'input[placeholder="联系您的手机号"]' }], attributes: { placeholder: '联系您的手机号', maxlength: '11' } },
  ]),
  templatePage('/pages/user/name-edit/index', [
    renderedText('.name-edit__input--desc', '最多可输入15个字'),
    { selector: 'input', scope: [{ has: 'input' }], attributes: { placeholder: '请输入文字' } },
  ]),
  templatePage('/pages/goods/list/index', filterNodes),
  templatePage('/pages/goods/details/index', [
    renderedText('.goods-name', '运动连帽拉链卫衣休闲开衫长袖多色运动细绒面料运动上衣'),
    renderedText('.comments-title-label', '商品评价'),
    renderedText('.desc-content__title--text', '详情介绍'),
  ]),
  templatePage('/pages/goods/search/index', [
    { selector: 'input', scope: [{ has: '.t-search' }], attributes: { placeholder: 'iPhone12pro' } },
    renderedText('.popular-wrap .search-title', '热门搜索'),
  ]),
  templatePage('/pages/goods/result/index', filterNodes),
  templatePage('/pages/goods/comments/index', [
    componentText('.comments-header-active', '全部(47)'),
  ]),
  templatePage('/pages/goods/comments/create/index', [
    renderedText('.convey-comment-title', '物流服务评价'),
    renderedText('.name', '匿名评价'),
  ]),
  templatePage('/pages/order/order-confirm/index', [
    renderedText('.submit-btn', '提交订单'),
    renderedText('.pay-remark', '选填，建议先和商家沟通确认'),
  ]),
  templatePage('/pages/order/receipt/index', [renderedText('.receipt-know', '发票须知')]),
  templatePage('/pages/order/pay-result/index', [
    renderedText('.pay-status text', '支付成功'),
    renderedText('.status-btn[data-type="orderList"]', '查看订单'),
    renderedText('.status-btn[data-type="home"]', '返回首页'),
  ]),
  templatePage('/pages/order/order-list/index', [
    { selector: '.order-number', count: 7 },
    { selector: '.bold-price', text: '实付', count: 7 },
  ]),
  templatePage('/pages/order/order-detail/index', [
    renderedText('.pay-detail.padding-inline > .pay-item:first-child .order-no', '132381532610540875'),
    { selector: '.order-no', count: 4 },
  ]),
  templatePage('/pages/order/apply-service/index', [
    renderedText('.textarea--label', '退款说明'),
  ]),
  templatePage('/pages/order/after-service-list/index', [
    { selector: '.status-desc', count: 10 },
  ]),
  templatePage('/pages/order/after-service-detail/index', [
    renderedText('.service-detail__header .title', '已退款'),
    renderedText('.service-detail__header .desc', '商家已退款，退回资金将原路三个工作日返回您的账户'),
  ]),
  templatePage('/pages/order/fill-tracking-no/index', [
    renderedText('.notice-bar', '请填写正确的退货包裹运单信息，以免影响退款进度'),
  ]),
  templatePage('/pages/order/delivery-detail/index', [renderedText('.logistics-no', 'SF123456')]),
  templatePage('/pages/order/invoice/index', [
    renderedText('.invoice-detail-box:first-child .invoice-detail-title', '发票详情'),
    renderedText('.invoice-detail-box:last-child .invoice-detail-title', '收票人信息'),
    { selector: '.invoice-detail-box-value', count: 8 },
  ]),
  templatePage('/pages/coupon/coupon-list/index', [renderedText('.center-entry-btn view', '领券中心')]),
  templatePage('/pages/coupon/coupon-detail/index', [
    componentText('button', '查看可用商品', 'button'),
  ]),
  templatePage('/pages/coupon/coupon-activity-goods/index', [renderedText('.height-light', '减18元')], [
    {
      id: 'coupon-activity:rules',
      action: 'open the coupon rules popup and inspect its rendered title',
      method: 'openStoreList',
      nodes: [renderedText('.popup-content-title', '规则详情')],
    },
  ]),
  templatePage('/pages/promotion/promotion-detail/index', [renderedText('.detail-entry-label', '规则详情')]),
]
