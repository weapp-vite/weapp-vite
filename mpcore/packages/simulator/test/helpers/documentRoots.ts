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
  ['pages/home/index.js', 'Page({ data: { title: "first title", price: 10, goodsList: [{ id: "natural-first", title: "naturally loaded first" }, { id: "natural-last", title: "naturally loaded last" }] } })'],
  ['pages/home/index.json', JSON.stringify({ usingComponents: { 'goods-card': '/components/goods-card/index' } })],
  ['pages/home/index.wxml', '<view id="header">{{title}}</view><view id="goods"><goods-card price="{{price}}" /></view><view id="goods-list"><goods-card wx:for="{{goodsList}}" wx:key="id" class="goods-card" title="{{item.title}}" /></view><view id="footer">footer</view>'],
  ['pages/profile/index.js', 'Page({})'],
  ['pages/profile/index.wxml', '<view>profile</view>'],
  ['components/goods-card/index.json', '{"component":true}'],
  ['components/goods-card/index.js', 'Component({ properties: { price: Number, title: String } })'],
  ['components/goods-card/index.wxml', '<text wx:if="{{title}}" class="goods-card__title">{{title}}</text><text wx:else id="price">price:{{price}}</text>'],
  ['custom-tab-bar/index.json', '{"component":true}'],
  ['custom-tab-bar/index.js', 'Component({})'],
  ['custom-tab-bar/index.wxml', '<view id="independent-tabbar">Home / Profile</view>'],
]

export const documentRootGoodsTitleXpath = '//*[contains(concat(" ", @class, " "), " goods-card__title ")]'

/** 返回各运行容器共用且相互独立的四卡片输入。 */
export function createDocumentRootGoodsList() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `prepared-${index + 1}`,
    title: `prepared goods ${index + 1}`,
  }))
}
