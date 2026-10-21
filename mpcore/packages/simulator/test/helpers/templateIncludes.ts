export function templateIncludeLeaf(marker: string) {
  return `<view class="included-leaf">${marker}:{{label}}:{{count}}:{{helper.tag}}</view><probe marker="{{label}}" />`
}

export function templateIncludeFiles(registration: 'page' | 'component' = 'page'): Array<[string, string]> {
  const template = '<wxs module="helper">module.exports={tag:"caller-wxs"}</wxs><template name="card"><text class="caller-template">caller-template</text></template><include src="/shared/includes/outer.wxml" /><template is="card" />'
  const data = '{label:"BASE",count:0}'
  const methods = 'increment(){this.setData({count:this.data.count+1})},update(label){this.setData({label})}'
  return [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', registration === 'page' ? `Page({data:${data},${methods}})` : 'Page({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: registration === 'page' ? { probe: '../../components/probe/index' } : { container: '../../components/container/index' } })],
    ['pages/index/index.wxml', registration === 'page' ? template : '<container id="container" />'],
    ['components/container/index.js', `Component({data:${data},methods:{${methods}}})`],
    ['components/container/index.json', '{"component":true,"usingComponents":{"probe":"../probe/index"}}'],
    ['components/container/index.wxml', template],
    ['components/probe/index.js', 'Component({properties:{marker:String},observers:{marker(value){getApp().includedMarker=value;wx.setStorageSync("included-probe",value)}}})'],
    ['components/probe/index.json', '{"component":true}'],
    ['components/probe/index.wxml', '<text class="included-probe">{{marker}}</text>'],
    ['shared/includes/outer.wxml', '<template name="card"><text class="excluded-template">must-not-shadow</text></template><wxs module="helper">throw new Error("included WXS must not execute")</wxs><include src="./nested/leaf" /><include src="./nested/leaf.wxml" />'],
    ['shared/includes/nested/leaf.wxml', templateIncludeLeaf('INIT')],
  ]
}
