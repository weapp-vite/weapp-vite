// 静态 React 编译器使用绑定快照对象作为原生组件首次挂载边界。
export const reactNativeInitialBindingFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({globalData:{attached:[]}})'],
  ['pages/index/index.json', '{"usingComponents":{"native-value":"/components/value/index"}}'],
  ['pages/index/index.js', 'Page({data:{slots:{}}})'],
  ['pages/index/index.wxml', '<block wx:if="{{slots.s0}}"><native-value id="value" value="{{slots.s0.value}}" enabled="{{slots.s0.enabled}}" label="{{slots.s0.label}}" /></block>'],
  ['components/value/index.json', '{"component":true}'],
  ['components/value/index.js', 'Component({properties:{value:Number,enabled:Boolean,label:String},data:{local:0},lifetimes:{attached(){getApp().globalData.attached.push({value:this.properties.value,enabled:this.properties.enabled,label:this.properties.label})}}})'],
  ['components/value/index.wxml', '<text id="number">{{value}}:{{local}}</text>'],
]
