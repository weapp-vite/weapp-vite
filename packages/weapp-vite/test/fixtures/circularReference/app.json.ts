import type { App } from 'weapp-vite/json'

export default <App>{
  pages: [
    'pages/index/index',
    'pages/index/index2',
  ],
  window: {
    navigationBarTextStyle: 'black',
    navigationBarTitleText: 'Weixin',
    navigationBarBackgroundColor: '#ffffff',
  },
  appBar: {},
  // subPackages: [
  //   {
  //     root: 'packageA',
  //     name: 'pack1',
  //     pages: [
  //       'pages/cat',
  //       'pages/dog',
  //     ],
  //     // "entry": "index.js"
  //   },
  //   {
  //     root: 'packageB',
  //     name: 'pack2',
  //     pages: [
  //       'pages/apple',
  //       'pages/banana',
  //     ],
  //     // 必须使用 js?
  //     // "entry": "index.js",
  //     // 独立分包应该特殊处理, 单独创建上下文
  //     independent: true,
  //   },
  // ],
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
  lazyCodeLoading: 'requiredComponents',
  themeLocation: 'theme.json',
  tabBar: {
    custom: true,
    color: '#000000',
    selectedColor: '#000000',
    backgroundColor: '#000000',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
      },
      {
        pagePath: 'pages/index/test',
        text: '测试',
      },
    ],
  },
  rendererOptions: {
    skyline: {
      disableABTest: true,
      defaultDisplayBlock: true,
      defaultContentBox: true,
      sdkVersionBegin: '3.4.3',
      sdkVersionEnd: '15.255.255',
    },
  },
}
