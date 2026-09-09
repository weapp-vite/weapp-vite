export const conditionalSlotFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'slot-host': '/components/slot-host' } })],
  ['pages/index/index.js', 'Page({ data: { branch: 0, open: true, label: "initial" } })'],
  ['pages/index/index.wxml', `<slot-host open="{{open}}">
    <view id="first" wx:if="{{branch === 0}}">first-{{label}}</view>
    <view id="second" wx:elif="{{branch === 1}}">second-{{label}}</view>
    <view id="third" wx:else>third-{{label}}</view>
    <view slot="header" id="header" wx:if="{{branch === 0}}">header-{{label}}</view>
  </slot-host>`],
  ['components/slot-host.json', JSON.stringify({ component: true })],
  ['components/slot-host.js', 'Component({ options: { multipleSlots: true }, properties: { open: Boolean } })'],
  ['components/slot-host.wxml', '<view wx:if="{{open}}"><slot name="header" /><slot /></view>'],
]
