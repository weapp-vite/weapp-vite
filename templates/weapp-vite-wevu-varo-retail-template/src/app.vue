<script setup lang="ts">
defineAppJson({
  pages: [
    'pages/home/index',
    'pages/cart/index',
    'pages/profile/index',
    'pages/orders/index',
    'pages/detail/index',
    'pages/checkout/index',
    'pages/address/index',
    'pages/result/index',
  ],
  window: {
    navigationBarTitleText: '日常咖啡铺',
    navigationBarBackgroundColor: '#f4f4e9',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f4f4e9',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#526258',
    selectedColor: '#215747',
    backgroundColor: '#fdfdf7',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '商店',
        iconPath: 'tabbar/store.png',
        selectedIconPath: 'tabbar/store-active.png',
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
        iconPath: 'tabbar/cart.png',
        selectedIconPath: 'tabbar/cart-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'tabbar/profile.png',
        selectedIconPath: 'tabbar/profile-active.png',
      },
    ],
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})
</script>
