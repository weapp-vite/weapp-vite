<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'

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
      pages: [
        'person-info/index',
        'address/list/index',
        'address/edit/index',
        'name-edit/index',
      ],
    },
    {
      root: 'pages/goods',
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
      pages: [
        'coupon-list/index',
        'coupon-detail/index',
        'coupon-activity-goods/index',
      ],
    },
    {
      root: 'pages/promotion',
      pages: [
        'promotion-detail/index',
      ],
    },
  ],
  window: {
    navigationBarTitleText: 'Retail Studio',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#0f172a',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/home',
        text: '首页',
        iconPath: 'tabbar/home.png',
        selectedIconPath: 'tabbar/home-active.png',
      },
      {
        pagePath: 'pages/category/index',
        text: '分类',
        iconPath: 'tabbar/data.png',
        selectedIconPath: 'tabbar/data-active.png',
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
        iconPath: 'tabbar/list.png',
        selectedIconPath: 'tabbar/list-active.png',
      },
      {
        pagePath: 'pages/usercenter/index',
        text: '我的',
        iconPath: 'tabbar/ability.png',
        selectedIconPath: 'tabbar/ability-active.png',
      },
    ],
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onShow(() => {
  console.log('[retail-template] app show')
})

onHide(() => {
  console.log('[retail-template] app hide')
})

onLaunch(() => {
  console.log('[retail-template] app launch')
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
