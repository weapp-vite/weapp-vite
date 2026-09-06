export const componentNavigationFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/a/index', 'pages/b/index'], tabBar: { list: [{ pagePath: 'pages/a/index', text: 'A' }, { pagePath: 'pages/b/index', text: 'B' }] } })],
  ['app.js', 'App({globalData:{attached:0,detached:0}})'],
  ['pages/a/index.json', JSON.stringify({ usingComponents: { probe: '/components/probe/index' } })],
  ['pages/a/index.js', 'Page({data:{visible:true}})'],
  ['pages/a/index.wxml', '<probe wx:if="{{visible}}" id="probe" />'],
  ['pages/b/index.json', '{}'],
  ['pages/b/index.js', 'Page({})'],
  ['pages/b/index.wxml', '<text>other tab</text>'],
  ['components/probe/index.json', '{"component":true}'],
  ['components/probe/index.js', `Component({
    data:{hidden:0,shown:0},
    lifetimes:{attached(){getApp().globalData.attached++},detached(){getApp().globalData.detached++}},
    pageLifetimes:{hide(){this.setData({hidden:this.data.hidden+1})},show(){this.setData({shown:this.data.shown+1})}}
  })`],
  ['components/probe/index.wxml', '<text id="history">hide={{hidden}} show={{shown}}</text>'],
]
