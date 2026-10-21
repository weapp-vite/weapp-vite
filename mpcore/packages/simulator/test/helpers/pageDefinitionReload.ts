export function pageDefinitionSource(marker: string, registration: 'page' | 'component' = 'page') {
  const methods = 'onLoad(){this.setData({count:shared.count})},increment(){shared.count++;this.setData({count:shared.count})},shared(){return shared}'
  const definition = `data:{marker:${JSON.stringify(marker)},count:shared.count}`
  return `const shared=require('../../shared/store');${registration === 'page' ? `Page({${definition},${methods}})` : `Component({${definition},methods:{${methods}}})`}`
}

export function pageDefinitionFiles(registration: 'page' | 'component' = 'page'): Array<[string, string]> {
  return [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index","pages/other/index","pages/unloaded/index"]}'],
    ['app.js', 'App({dependencyLoads:0,extraLoads:0})'],
    ['shared/store.js', 'getApp().dependencyLoads++;module.exports={count:0,token:{}}'],
    ['shared/extra.js', 'getApp().extraLoads++;module.exports={}'],
    ['pages/index/index.js', pageDefinitionSource('BASE', registration)],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.wxml', '<view class="marker">{{marker}}:{{count}}</view>'],
    ['pages/other/index.js', pageDefinitionSource('SIDE')],
    ['pages/other/index.json', '{}'],
    ['pages/other/index.wxml', '<view class="marker">{{marker}}:{{count}}</view>'],
    ['pages/unloaded/index.js', 'Page({})'],
    ['pages/unloaded/index.json', '{}'],
    ['pages/unloaded/index.wxml', '<view />'],
  ]
}
