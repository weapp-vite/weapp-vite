import type { App } from 'weapp-vite/json'

export default <App>{
  pages: [
    'pages/index/index',
    'pages/features/runtime/index',
    'pages/features/ui/index',
    'pages/features/build/index',
    'pages/subpackages/demo',
  ],
  window: {
    navigationBarTextStyle: 'black',
    navigationBarTitleText: 'Weixin',
    navigationBarBackgroundColor: '#ffffff',
  },
  appBar: {},
  usingComponents: {
    'navigation-bar': '/components/navigation-bar/navigation-bar',
  },
  darkmode: true,

  subPackages: [
    {
      root: 'packageA',
      name: 'pack1',
      pages: [
        'pages/cat',
        'pages/dog',
        'pages/weui',
        'pages/shared-demo/index',
      ],
      // "entry": "index.js"
    },
    {
      root: 'packageB',
      name: 'pack2',
      pages: [
        'pages/apple',
        'pages/banana',
        'pages/independent-demo/index',
      ],
      // 必须使用 js?
      // "entry": "index.js",
      // 独立分包应该特殊处理, 单独创建上下文
      independent: true,
    },
    {
      root: 'packageC',
      name: 'pack3',
      pages: [
        'pages/cat',
        'pages/dog',
        'pages/shared-demo/index',
      ],
      // "entry": "index.js"
    },
  ],
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
        pagePath: 'pages/features/ui/index',
        text: 'UI',
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
  // https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html
  workers: 'workers',
  useExtendedLib: {
    kbone: true,
    weui: true,
  },
  // {
  //   path: 'workers',
  //   isSubpackage: true,
  // },
  // plugins: {
  //   myPlugin: {
  //     version: '1.0.0',
  //     provider: 'wx6ffee4673b257014',
  //     export: 'index.js',
  //   },
  // },
}
