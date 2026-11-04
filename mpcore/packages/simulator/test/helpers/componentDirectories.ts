export const componentDirectoryRoute = '/pages/index/index'

export const componentDirectoryFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: {
    'relative-host': '../../components/host',
    'absolute-leaf': '/components/leaf',
    'preferred-card': '/components/preferred',
  } })],
  ['pages/index/index.js', 'Page({data:{label:"initial"}})'],
  ['pages/index/index.wxml', '<view><relative-host id="host" label="{{label}}" /><absolute-leaf id="leaf" label="root" /><preferred-card id="preferred" /></view>'],
  ['components/host/index.json', JSON.stringify({ component: true, usingComponents: { 'nested-leaf': '../leaf' } })],
  ['components/host/index.js', 'Component({properties:{label:String}})'],
  ['components/host/index.wxml', '<view><text class="host-value">host:{{label}}</text><nested-leaf id="nested" label="{{label}}" /></view>'],
  ['components/leaf/index.json', JSON.stringify({ component: true })],
  ['components/leaf/index.js', 'Component({properties:{label:String},data:{count:0},methods:{increment(){this.setData({count:this.data.count+1})}}})'],
  ['components/leaf/index.wxml', '<view><text class="leaf-value">{{label}}:{{count}}</text><button class="increment" bindtap="increment">increment</button></view>'],
  ['components/preferred.json', JSON.stringify({ component: true })],
  ['components/preferred.js', 'Component({data:{label:"explicit"}})'],
  ['components/preferred.wxml', '<text class="preferred-value">{{label}}</text>'],
  ['components/preferred/index.json', JSON.stringify({ component: true })],
  ['components/preferred/index.js', 'Component({data:{label:"directory-fallback"}})'],
  ['components/preferred/index.wxml', '<text class="preferred-value">{{label}}</text>'],
]
