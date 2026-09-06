export const wxsFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { card: '/components/card' } })],
  ['pages/index/index.js', `Page({ data: { platform: 'weapp', payload: { label: 'original' }, platformTools: 'page-data' } })`],
  ['pages/index/format.wxs', `exports.label = function(value) { return value || 'unknown' }`],
  ['pages/index/platform.wxs', `var format = require('./format.wxs'); module.exports = { label: format.label }`],
  ['pages/index/index.wxml', `
    <wxs module="platformTools" src="./platform.wxs" />
    <wxs module="pageOnly">module.exports = { label: function() { return 'page-only' } }</wxs>
    <wxs module="inlineTools">
      module.exports = {
        show: function(value) { return value.length<20 },
        items: function(value) { return [value, 'second'] },
        mutate: function(value) { value.label = 'wxs-copy'; return value.label },
        host: function() { return typeof wx + ':' + typeof getApp },
        markup: function() { return '<tag></script>' }
      }
    </wxs>
    <import src="../../templates/card.wxml" />
    <view id="platform-marker">MP_PLATFORM={{platformTools.label(platform)}}</view>
    <view id="inline" wx:if="{{inlineTools.show(platform)}}">{{inlineTools.host()}}</view>
    <view class="loop" wx:for="{{inlineTools.items(platform)}}">{{platformTools.label(item)}}</view>
    <view id="payload">{{inlineTools.mutate(payload)}}</view>
    <view id="literal">{{inlineTools.markup()}}</view>
    <template is="imported" data="{{label:platform}}" />
    <template name="local"><text id="local">{{platformTools.label(label)}}</text></template>
    <template is="local" data="{{label:platform}}" />
    <card label="{{platformTools.label(platform)}}" />
  `],
  ['templates/card.wxml', `
    <wxs module="platformTools" src="./card.wxs" />
    <template name="imported">
      <text id="imported">{{platformTools.label(label)}}</text>
      <text id="import-leak">{{pageOnly.label(label)}}</text>
    </template>
  `],
  ['templates/card.wxs', `module.exports = { label: function(value) { return 'imported:' + value } }`],
  ['components/card.json', JSON.stringify({ component: true })],
  ['components/card.js', 'Component({ properties: { label: String } })'],
  ['components/card.wxml', `
    <wxs module="platformTools">module.exports = { label: function(value) { return 'component:' + value } }</wxs>
    <text id="component">{{platformTools.label(label)}}</text>
    <text id="component-leak">{{pageOnly.label(label)}}</text>
  `],
]
