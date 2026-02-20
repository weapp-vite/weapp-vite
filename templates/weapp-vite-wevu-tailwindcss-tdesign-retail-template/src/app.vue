<script setup lang="ts">
defineAppJson({
  pages: [
    'pages/home/home',
    'pages/category/index',
    'pages/cart/index',
    'pages/usercenter/index',
  ],
  subPackages: [
    {
      root: 'pages/user',
      name: 'user',
      pages: [
        'person-info/index',
        'address/list/index',
        'address/edit/index',
        'name-edit/index',
      ],
    },
    {
      root: 'pages/goods',
      name: 'goods',
      pages: [
        'list/index',
        'details/index',
        'search/index',
        'result/index',
        'comments/index',
        'comments/create/index',
      ],
    },
    {
      root: 'pages/order',
      name: 'order',
      pages: [
        'order-confirm/index',
        'receipt/index',
        'pay-result/index',
        'order-list/index',
        'order-detail/index',
        'apply-service/index',
        'after-service-list/index',
        'after-service-detail/index',
        'fill-tracking-no/index',
        'delivery-detail/index',
        'invoice/index',
      ],
    },
    {
      root: 'pages/coupon',
      name: 'coupon',
      pages: [
        'coupon-list/index',
        'coupon-detail/index',
        'coupon-activity-goods/index',
      ],
    },
    {
      root: 'pages/promotion',
      name: 'promotion',
      pages: [
        'promotion-detail/index',
      ],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Weixin',
    navigationBarTextStyle: 'black',
  },
  requiredPrivateInfos: ['chooseAddress'],
  lazyCodeLoading: 'requiredComponents',
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '#666666',
    selectedColor: '#FF5F15',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/home',
        text: '首页',
      },
      {
        pagePath: 'pages/category/index',
        text: '分类',
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
      },
      {
        pagePath: 'pages/usercenter/index',
        text: '我的',
      },
    ],
  },
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示',
    },
  },
  sitemapLocation: 'sitemap.json',
})
</script>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;

page {
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #0f172a;
  background-color: #f8fafc;
}
</style>
