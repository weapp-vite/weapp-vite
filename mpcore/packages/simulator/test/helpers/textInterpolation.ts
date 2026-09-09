export const textInterpolationFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({data:{value:null,nested:{value:null},flag:false,count:0,empty:""}})'],
  ['pages/index/index.wxml', '<view><text id="direct">{{value}}</text><text id="mixed">value={{value}};missing={{missing}}</text><text id="missing">{{missing}}</text><text id="nested">{{nested.value}}</text><text id="literal">{{null}}</text><text id="scalars">{{flag}}/{{count}}/{{empty}}</text><view id="attributes" data-value="{{value}}" data-mixed="value={{value}}" /></view>'],
]
