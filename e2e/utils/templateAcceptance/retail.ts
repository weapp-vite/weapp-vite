import type { DomNodeExpectation } from '../domAcceptance/types'
import type { TemplateDomRoute } from './index'
import { renderedText, templatePage } from './index'
import { RETAIL_CHECKOUT_ROUTE, retailCheckoutNodes } from './retailCheckout'

function componentText(selector: string, text: string, marker = selector): DomNodeExpectation {
  return renderedText(selector, text, [{ has: marker }])
}

const filterNodes = [
  componentText('#filter-overall', '综合', '.filter-wrap'),
  componentText('#filter-price-label', '价格', '.filter-wrap'),
]

// 独立固定订单号与实付金额，分页验收不读取生产 model 作为期望值。
const orderPayments = [
  { number: '354021731671873099', integer: '0', decimal: '.20' },
  { number: '132381532610540875', integer: '368', decimal: '.00' },
  { number: '132222623132329291', integer: '4586', decimal: '.00' },
  { number: '130862219672031307', integer: '2632', decimal: '.00' },
  { number: '130494472895208267', integer: '249', decimal: '.00' },
  { number: '130169571554503755', integer: '5082', decimal: '.00' },
  { number: '130150835531421259', integer: '40', decimal: '.00' },
]

function orderListNodes(count: 5 | 7): DomNodeExpectation[] {
  return [
    { selector: '.order-number', count },
    { selector: '.bold-price', text: '实付', count },
    { selector: '.real-pay', count },
    { selector: '//*[contains(concat(" ", @class, " "), " real-pay ")]//*[contains(concat(" ", @class, " "), " integer ")]', query: 'xpath', count },
    { selector: '//*[contains(concat(" ", @class, " "), " real-pay ")]//*[contains(concat(" ", @class, " "), " decimal ")]', query: 'xpath', count },
    ...orderPayments.slice(0, count).flatMap(({ number, integer, decimal }, index): DomNodeExpectation[] => {
      // 真实 IDE 已逐项验证首屏和翻页后的相同业务顺序；slot 不参与卡片祖先谓词关联。
      const orderNumber = '//*[contains(concat(" ", @class, " "), " order-number ")]'
      const amount = '//*[contains(concat(" ", @class, " "), " real-pay ")]'
      return [
        { selector: `(${orderNumber})[${index + 1}]`, query: 'xpath', count: 1, text: `订单号\u00A0  ${number}` },
        { selector: `(${amount}//*[contains(concat(" ", @class, " "), " integer ")])[${index + 1}]`, query: 'xpath', text: integer },
        { selector: `(${amount}//*[contains(concat(" ", @class, " "), " decimal ")])[${index + 1}]`, query: 'xpath', text: decimal },
      ]
    }),
  ]
}

function commentFilterNodes(text: string): DomNodeExpectation[] {
  return [
    {
      ...componentText('.t-tag--danger', text),
      styles: { 'color': 'rgb(250, 65, 38)', 'background-color': 'rgb(255, 236, 233)', 'border-top-color': 'rgb(250, 65, 38)' },
    },
    {
      selector: '//*[contains(concat(" ", @class, " "), " t-tag--default ")]',
      query: 'xpath',
      count: 4,
      styles: { 'color': 'rgb(51, 51, 51)', 'background-color': 'rgb(245, 245, 245)' },
    },
  ]
}

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
    componentText('.order-group__item[data-order-status="5"] .order-group__item__title', '待付款', '.order-group'),
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
  templatePage('/pages/goods/comments/index', commentFilterNodes('全部(47)'), [
    { id: 'comments-filter:image', action: 'tap image comments and inspect the selected label and colors', tap: { selector: '#comments-filter-image' }, nodes: commentFilterNodes('带图(1)') },
    { id: 'comments-filter:good', action: 'tap positive comments and inspect the selected label and colors', tap: { selector: '#comments-filter-good' }, nodes: commentFilterNodes('好评(45)') },
    { id: 'comments-filter:all', action: 'tap all comments and inspect the restored selected label and colors', tap: { selector: '#comments-filter-all' }, nodes: commentFilterNodes('全部(47)') },
  ]),
  templatePage('/pages/goods/comments/create/index', [
    renderedText('.convey-comment-title', '物流服务评价'),
    renderedText('.name', '匿名评价'),
  ]),
  templatePage(RETAIL_CHECKOUT_ROUTE, retailCheckoutNodes()),
  templatePage('/pages/order/receipt/index', [
    renderedText('#receipt-none', '不开发票'),
    renderedText('#receipt-electronic', '电子发票'),
    { selector: '.receipt-know', count: 0 },
  ], [
    {
      id: 'receipt:electronic',
      action: '选择电子发票，检查发票须知和个人开票信息输入框',
      tap: { selector: '#receipt-electronic' },
      nodes: [
        renderedText('.receipt-know', '发票须知'),
        { selector: 'input', scope: [{ has: 'input[placeholder="请输入您的姓名"]' }], attributes: { placeholder: '请输入您的姓名' } },
        { selector: 'input', scope: [{ has: 'input[placeholder="请输入您的手机号"]' }], attributes: { placeholder: '请输入您的手机号' } },
      ],
    },
  ]),
  templatePage('/pages/order/pay-result/index', [
    renderedText('.pay-status text', '支付成功'),
    renderedText('.status-btn[data-type="orderList"]', '查看订单'),
    renderedText('.status-btn[data-type="home"]', '返回首页'),
  ]),
  templatePage('/pages/order/order-list/index', orderListNodes(5), [
    {
      id: 'order-list:load-more',
      action: '触发页面 onReachBottom 加载第二页，检查七笔订单号及对应实付金额，确认首屏订单保留',
      method: 'onReachBottom',
      nodes: orderListNodes(7),
    },
  ]),
  templatePage('/pages/order/order-detail/index', [
    renderedText('#order-detail-number', '132381532610540875'),
    { selector: '.order-no', count: 4 },
  ]),
  templatePage('/pages/order/apply-service/index', [
    { selector: '//*[@title="申请退款（无需退货）"]//*[contains(concat(" ", @class, " "), " t-cell__title-text ")]', query: 'xpath', text: '申请退款（无需退货）' },
    { selector: '//*[@title="退货退款"]//*[contains(concat(" ", @class, " "), " t-cell__title-text ")]', query: 'xpath', text: '退货退款' },
    { selector: '.textarea--label', count: 0 },
  ], [
    {
      id: 'apply-service:refund-form',
      action: '点击申请退款（无需退货），检查类型选择消失、退款说明和选填输入框出现',
      tap: { selector: '[title="申请退款（无需退货）"]' },
      nodes: [
        { selector: '.service-choice', count: 0 },
        renderedText('.textarea--label', '退款说明'),
        { selector: '//textarea[@placeholder="退款说明（选填）"]', query: 'xpath', attributes: { placeholder: '退款说明（选填）', maxlength: '200' } },
      ],
    },
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
    renderedText('#invoice-details-title', '发票详情'),
    renderedText('#invoice-recipient-title', '收票人信息'),
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
