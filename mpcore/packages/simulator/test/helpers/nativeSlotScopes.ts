export const nativeSlotScopeFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: {
    'native-host': '/components/native-host',
    'probe': '/components/probe',
    'generic-host': '/components/generic-host',
    'row-list': '/components/row-list',
  } })],
  ['pages/index/index.js', 'Page({ data: { owner: "owner value", labels: ["first", "second", "third"] } })'],
  ['pages/index/index.wxml', `
    <native-host id="plain-host"><probe id="plain" value="{{owner}}" /></native-host>
    <generic-host id="list-host" labels="{{labels}}" generic:content="row-list" />
  `],
  ['components/native-host.json', JSON.stringify({ component: true })],
  ['components/native-host.js', 'Component({})'],
  ['components/native-host.wxml', '<view class="native-slot-frame"><slot /></view>'],
  ['components/probe.json', JSON.stringify({ component: true })],
  ['components/probe.js', 'Component({ properties: { value: String } })'],
  ['components/probe.wxml', '<text class="probe-value">{{value}}</text>'],
  ['components/generic-host.json', JSON.stringify({ component: true, componentGenerics: { content: true } })],
  ['components/generic-host.js', 'Component({ properties: { labels: Array } })'],
  ['components/generic-host.wxml', '<content labels="{{labels}}" />'],
  ['components/row-list.json', JSON.stringify({ component: true, usingComponents: { 'native-host': './native-host' } })],
  ['components/row-list.js', 'Component({ properties: { labels: Array } })'],
  ['components/row-list.wxml', `
    <view class="row-list">
      <native-host wx:for="{{labels}}" wx:key="*this" id="{{'item-' + item}}" class="row-item">
        <text id="{{item}}" class="row-label">{{item}}</text>
      </native-host>
    </view>
  `],
]
