export type RetailLayoutKind
  = | 'home'
    | 'category'
    | 'cart'
    | 'user-center'
    | 'goods-list'
    | 'goods-search'
    | 'goods-detail'
    | 'goods-comments'
    | 'goods-comment-create'
    | 'order-confirm'
    | 'order-list'
    | 'order-detail'
    | 'order-form'
    | 'order-pay-result'
    | 'coupon-list'
    | 'coupon-detail'
    | 'coupon-goods'
    | 'promotion-detail'
    | 'user-profile'
    | 'user-address-list'
    | 'user-form'
    | 'generic'

const ROUTE_LAYOUT_KIND_MAP: Record<string, RetailLayoutKind> = {
  'pages/home/home': 'home',
  'pages/category/index': 'category',
  'pages/cart/index': 'cart',
  'pages/usercenter/index': 'user-center',

  'pages/goods/list/index': 'goods-list',
  'pages/goods/result/index': 'goods-list',
  'pages/goods/search/index': 'goods-search',
  'pages/goods/details/index': 'goods-detail',
  'pages/goods/comments/index': 'goods-comments',
  'pages/goods/comments/create/index': 'goods-comment-create',

  'pages/order/order-confirm/index': 'order-confirm',
  'pages/order/order-list/index': 'order-list',
  'pages/order/after-service-list/index': 'order-list',
  'pages/order/order-detail/index': 'order-detail',
  'pages/order/after-service-detail/index': 'order-detail',
  'pages/order/delivery-detail/index': 'order-detail',
  'pages/order/apply-service/index': 'order-form',
  'pages/order/fill-tracking-no/index': 'order-form',
  'pages/order/invoice/index': 'order-form',
  'pages/order/receipt/index': 'order-form',
  'pages/order/pay-result/index': 'order-pay-result',

  'pages/coupon/coupon-list/index': 'coupon-list',
  'pages/coupon/coupon-detail/index': 'coupon-detail',
  'pages/coupon/coupon-activity-goods/index': 'coupon-goods',
  'pages/promotion/promotion-detail/index': 'promotion-detail',

  'pages/user/person-info/index': 'user-profile',
  'pages/user/address/list/index': 'user-address-list',
  'pages/user/address/edit/index': 'user-form',
  'pages/user/name-edit/index': 'user-form',
}

export function resolveRetailLayoutKind(route: string): RetailLayoutKind {
  return ROUTE_LAYOUT_KIND_MAP[route] || 'generic'
}
