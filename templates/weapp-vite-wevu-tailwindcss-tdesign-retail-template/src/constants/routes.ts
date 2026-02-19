import type { RetailRouteMeta } from '@/types/retail'

export const RETAIL_ROUTES: RetailRouteMeta[] = [
  {
    path: 'pages/home/home',
    title: '首页',
    group: '主包',
    tab: true,
  },
  {
    path: 'pages/category/index',
    title: '分类',
    group: '主包',
    tab: true,
  },
  {
    path: 'pages/cart/index',
    title: '购物车',
    group: '主包',
    tab: true,
  },
  {
    path: 'pages/usercenter/index',
    title: '我的',
    group: '主包',
    tab: true,
  },
  {
    path: 'pages/user/person-info/index',
    title: '个人信息',
    group: '用户分包',
    tab: false,
  },
  {
    path: 'pages/user/address/list/index',
    title: '地址列表',
    group: '用户分包',
    tab: false,
  },
  {
    path: 'pages/user/address/edit/index',
    title: '编辑地址',
    group: '用户分包',
    tab: false,
  },
  {
    path: 'pages/user/name-edit/index',
    title: '昵称编辑',
    group: '用户分包',
    tab: false,
  },
  {
    path: 'pages/goods/list/index',
    title: '商品列表',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/goods/details/index',
    title: '商品详情',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/goods/search/index',
    title: '商品搜索',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/goods/result/index',
    title: '搜索结果',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/goods/comments/index',
    title: '商品评论',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/goods/comments/create/index',
    title: '发布评论',
    group: '商品分包',
    tab: false,
  },
  {
    path: 'pages/order/order-confirm/index',
    title: '确认订单',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/receipt/index',
    title: '发票抬头',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/pay-result/index',
    title: '支付结果',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/order-list/index',
    title: '订单列表',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/order-detail/index',
    title: '订单详情',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/apply-service/index',
    title: '申请售后',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/after-service-list/index',
    title: '售后列表',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/after-service-detail/index',
    title: '售后详情',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/fill-tracking-no/index',
    title: '填写单号',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/delivery-detail/index',
    title: '物流详情',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/order/invoice/index',
    title: '发票信息',
    group: '订单分包',
    tab: false,
  },
  {
    path: 'pages/coupon/coupon-list/index',
    title: '优惠券列表',
    group: '优惠券分包',
    tab: false,
  },
  {
    path: 'pages/coupon/coupon-detail/index',
    title: '优惠券详情',
    group: '优惠券分包',
    tab: false,
  },
  {
    path: 'pages/coupon/coupon-activity-goods/index',
    title: '券活动商品',
    group: '优惠券分包',
    tab: false,
  },
  {
    path: 'pages/promotion/promotion-detail/index',
    title: '营销活动详情',
    group: '营销分包',
    tab: false,
  },
]

export const RETAIL_ROUTE_MAP = new Map(RETAIL_ROUTES.map(route => [route.path, route]))

export const RETAIL_TAB_ROUTES = new Set(RETAIL_ROUTES.filter(route => route.tab).map(route => route.path))

export function resolveRetailRoute(path: string) {
  return RETAIL_ROUTE_MAP.get(path)
}

export function getRetailNeighbors(path: string) {
  const index = RETAIL_ROUTES.findIndex(route => route.path === path)
  if (index === -1) {
    return {
      previous: RETAIL_ROUTES[RETAIL_ROUTES.length - 1],
      next: RETAIL_ROUTES[0],
    }
  }
  return {
    previous: RETAIL_ROUTES[(index - 1 + RETAIL_ROUTES.length) % RETAIL_ROUTES.length],
    next: RETAIL_ROUTES[(index + 1) % RETAIL_ROUTES.length],
  }
}
