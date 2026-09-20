export const objectLoopFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{}'],
  ['pages/index/index.js', 'Page({data:{apis:{fetch:"function",xmlHttpRequest:"undefined"}}})'],
  ['pages/index/index.wxml', '<text wx:for="{{apis}}" wx:key="index" id="api-{{index}}">{{index}}={{item}}</text>'],
]
