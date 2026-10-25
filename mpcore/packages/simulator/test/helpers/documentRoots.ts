export const documentRootFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({
    pages: ['pages/home/index', 'pages/profile/index'],
    tabBar: { custom: true, list: [
      { pagePath: 'pages/home/index', text: 'Home' },
      { pagePath: 'pages/profile/index', text: 'Profile' },
    ] },
  })],
  ['app.js', 'App({})'],
  ['pages/home/index.js', 'Page({ data: { title: "first title", price: 10 } })'],
  ['pages/home/index.json', JSON.stringify({ usingComponents: { 'goods-card': '/components/goods-card/index' } })],
  ['pages/home/index.wxml', '<view id="header">{{title}}</view><view id="goods"><goods-card price="{{price}}" /></view><view id="footer">footer</view>'],
  ['pages/profile/index.js', 'Page({})'],
  ['pages/profile/index.wxml', '<view>profile</view>'],
  ['components/goods-card/index.json', '{"component":true}'],
  ['components/goods-card/index.js', 'Component({ properties: { price: Number } })'],
  ['components/goods-card/index.wxml', '<text id="price">price:{{price}}</text>'],
  ['custom-tab-bar/index.json', '{"component":true}'],
  ['custom-tab-bar/index.js', 'Component({})'],
  ['custom-tab-bar/index.wxml', '<view id="independent-tabbar">Home / Profile</view>'],
]
