<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'
import { wpi } from 'wevu/api'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/layouts/index',
    'pages/layout-store/index',
    'pages/layout-feedback/index',
    'pages/data/index',
    'pages/form/index',
    'pages/list/index',
    'pages/ability/index',
  ],
  window: {
    navigationBarTitleText: 'Weapp Studio',
    navigationBarBackgroundColor: '#2f2b5f',
    navigationBarTextStyle: 'white',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#7a7aa0',
    selectedColor: '#2f2b5f',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'tabbar/home.png',
        selectedIconPath: 'tabbar/home-active.png',
      },
      {
        pagePath: 'pages/data/index',
        text: '数据',
        iconPath: 'tabbar/data.png',
        selectedIconPath: 'tabbar/data-active.png',
      },
      {
        pagePath: 'pages/form/index',
        text: '表单',
        iconPath: 'tabbar/form.png',
        selectedIconPath: 'tabbar/form-active.png',
      },
      {
        pagePath: 'pages/list/index',
        text: '清单',
        iconPath: 'tabbar/list.png',
        selectedIconPath: 'tabbar/list-active.png',
      },
      {
        pagePath: 'pages/ability/index',
        text: '能力',
        iconPath: 'tabbar/ability.png',
        selectedIconPath: 'tabbar/ability-active.png',
      },
    ],
  },
  subPackages: [
    {
      root: 'subpackages/lab',
      pages: ['index', 'class-binding/index', 'virtual-host-class/index'],
    },
    {
      root: 'subpackages/ability',
      pages: ['index'],
    },
  ],
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

const logger = wpi.getLogManager({ level: 1 })

onShow(() => {
  logger.info('[weapp-vite-wevu-template] app show')
})

onHide(() => {
  logger.info('[weapp-vite-wevu-template] app hide')
})

onLaunch(() => {
  logger.info('[weapp-vite-wevu-template] app launch')
})
</script>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;

page {
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background-color: #f6f7fb;
}
</style>
