export const nativeRefresherFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'refresh-panel': '/components/panel/index' } })],
  ['pages/index/index.js', `Page({
    data: { state: { triggered: false, sibling: 0 }, enabled: true, visible: true, noise: 0, events: [], reenter: false,
      states: [{ triggered: false }, { triggered: false }], active: 0, forced: false, items: [{ id: 'item', triggered: false }],
      flags: [false, false], flag: false, scalarState: { triggered: false, sibling: 0 },
      scalarSources: [{ alias: false, sibling: 0 }, { alias: false, sibling: 0 }], optionalSource: {}, shadowedFlag: false },
    record(event) {
      const events = [...this.data.events, { type: event.type, triggered: this.data.state.triggered, id: event.currentTarget.id }]
      this.setData({ events, trace: JSON.stringify(events) })
      if (event.type === 'refresherrestore' && this.data.reenter) {
        this.setData({ reenter: false, 'state.triggered': true })
      }
    },
    measure() { return wx.createSelectorQuery().select('#primary').scrollOffset().exec()[0] },
  })`],
  ['pages/index/index.wxml', `
<wxs module="shadowedFlag">module.exports = false</wxs>
<scroll-view wx:if="{{visible}}" id="primary" scroll-y refresher-enabled="{{enabled}}" refresher-triggered="{{state.triggered}}" refresher-threshold="45" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherabort="record" bindrefresherrestore="record" style="height:100px">
  <view id="content" style="height:500px">content</view>
</scroll-view>
<text id="trace">{{trace}}</text>
<scroll-view id="derived" scroll-y refresher-enabled refresher-triggered="{{states[active].triggered || forced}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">derived</view></scroll-view>
<scroll-view wx:for="{{items}}" id="{{item.id}}" scroll-y refresher-enabled refresher-triggered="{{item.triggered}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">item</view></scroll-view>
<scroll-view wx:for="{{flags}}" wx:for-item="flag" id="flag-{{index}}" scroll-y refresher-enabled refresher-triggered="{{flag}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">flag</view></scroll-view>
<template name="scalar"><scroll-view id="{{aliasId}}" scroll-y refresher-enabled refresher-triggered="{{alias}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">alias</view></scroll-view></template>
<template is="scalar" data="{{alias: scalarState.triggered, aliasId: 'scalar'}}" />
<template name="nested"><scroll-view id="nested-scalar" scroll-y refresher-enabled refresher-triggered="{{config.value}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">nested</view></scroll-view></template>
<template is="nested" data="{{config: active === 0 ? {value: scalarState.triggered, other: noise} : {value: forced}}}" />
<template is="scalar" data="{{...scalarSources[active], aliasId: 'spread-scalar'}}" />
<template is="scalar" data="{{alias: scalarState.triggered, ...optionalSource, aliasId: 'optional-scalar'}}" />
<scroll-view id="wxs-shadow" scroll-y refresher-enabled refresher-triggered="{{shadowedFlag}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">WXS</view></scroll-view>
<scroll-view wx:for="{{[flags[0], flags[1]]}}" id="literal-{{index}}" scroll-y refresher-enabled refresher-triggered="{{item}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">literal</view></scroll-view>
<refresh-panel id="panel" external="{{state.triggered}}" />
`],
  ['components/panel/index.json', '{"component":true}'],
  ['components/panel/index.js', `Component({
    properties: { external: Boolean },
    data: { triggered: false, noise: 0, events: [] },
    methods: {
      record(event) { this.setData({ events: [...this.data.events, event.type] }) },
    },
  })`],
  ['components/panel/index.wxml', '<scroll-view id="local" scroll-y refresher-enabled refresher-triggered="{{triggered}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherabort="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">local</view></scroll-view><scroll-view id="external" scroll-y refresher-enabled refresher-triggered="{{external}}" bindrefresherpulling="record" bindrefresherrefresh="record" bindrefresherrestore="record" style="height:100px"><view style="height:500px">external</view></scroll-view>'],
  ['pages/detail/index.js', 'Page({})'],
  ['pages/detail/index.wxml', '<view>detail</view>'],
]
