export const registryRoute = '/pages/index/index'
export const registryPageConfig = 'pages/index/index.json'

export function registryConfig(target = 'registry-a') {
  return JSON.stringify({ usingComponents: { 'registry-panel': target } })
}

export function registryComponentFiles(target: string, marker: string): Array<[string, string]> {
  const base = `miniprogram_npm/${target}/index`
  return [
    [`${base}.json`, '{"component":true}'],
    [`${base}.js`, 'Component({properties:{label:String},data:{ready:false},lifetimes:{attached(){this.setData({ready:true})}}})'],
    [`${base}.wxml`, `<view><text class="value">${marker}:{{label}}:{{ready}}</text><slot/></view>`],
  ]
}

export function registryFiles(target = 'registry-a'): Array<[string, string]> {
  return [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({data:{show:false,left:"left",right:"right"}})'],
    [registryPageConfig, registryConfig(target)],
    ['pages/index/index.wxml', '<view><view wx:for="{{[1,2,3,4,5,6]}}" wx:key="*this"><text>{{item}}</text></view><registry-panel wx:if="{{show}}" id="left" label="{{left}}"><text class="slot">left slot</text></registry-panel><registry-panel wx:if="{{show}}" id="right" label="{{right}}"><text class="slot">right slot</text></registry-panel></view>'],
    ...registryComponentFiles('registry-a', 'A'),
    ...registryComponentFiles('registry-b', 'B'),
  ]
}
