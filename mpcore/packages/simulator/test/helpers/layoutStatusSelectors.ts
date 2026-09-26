export const layoutStatusSelectorFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({data:{status:"default"},setStatus(status){this.setData({status})}})'],
  ['pages/index/index.wxml', `
<view class="bg-linear-to-br">
  <view><text class="leading-7">当前状态：{{status}}</text></view>
</view>
<view class="cards">
  <text class="leading-7">默认布局说明</text>
  <text class="leading-7">后台布局说明</text>
  <text class="leading-7">无布局说明</text>
</view>`],
]
