export const sharedModuleStateFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/first/index', 'pages/second/index'] })],
  ['app.js', 'App({})'],
  ['shared.js', 'exports.store = { count: 0 }'],
  ...['first', 'second'].flatMap(marker => [
    [`pages/${marker}/index.js`, `const { store } = require('../../shared'); Page({
      data: { count: store.count, local: 0, marker: '${marker}' },
      increment() { store.count++; this.setData({ count: store.count, local: this.data.local + 1 }) },
    })`],
    [`pages/${marker}/index.wxml`, '<view id="marker">{{marker}}</view><view id="count">{{count}}</view><view id="local">{{local}}</view>'],
  ] as Array<[string, string]>),
]
