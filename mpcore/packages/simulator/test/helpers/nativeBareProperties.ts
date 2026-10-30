export const nativeBarePropertiesFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"bare-probe":"/components/probe","behavior-probe":"/components/behavior-probe"}}'],
  ['pages/index/index.js', `Page({
    data: { empty: '', nothing: null, rows: [{ id: 'first' }, { id: 'second' }] },
    update(value) { this.setData({ empty: value }) },
  })`],
  ['pages/index/index.wxml', `
<bare-probe id="bare" payload />
<bare-probe id="empty" payload="" />
<bare-probe id="bound-empty" payload="{{empty}}" />
<bare-probe id="null" payload="{{nothing}}" />
<bare-probe id="undefined" payload="{{missing}}" />
<bare-probe id="omitted" />
<bare-probe id="true" payload="{{true}}" />
<bare-probe id="false" payload="{{false}}" />
<bare-probe id="camel" is-enabled />
<bare-probe id="unknown" unknown />
<behavior-probe id="behavior-bare" payload is-enabled />
<behavior-probe id="behavior-bound" payload="{{empty}}" is-enabled="{{true}}" />
<behavior-probe id="behavior-default" />
<view wx:for="{{rows}}" wx:key="id"><bare-probe class="loop-probe" payload /></view>
<include src="./included.wxml" />
`],
  ['pages/index/included.wxml', '<bare-probe id="included" payload />'],
  ['components/probe.json', '{"component":true}'],
  ['components/probe.js', `
function describe(value) {
  return value === null ? 'null' : typeof value + ':' + String(value)
}
Component({
  properties: {
    payload: { type: null, value: 'fallback', observer: 'record' },
    isEnabled: { type: null, value: false },
  },
  data: { summary: '', camel: '', unknownPresent: false },
  methods: {
    record(value) { this.setData({ summary: describe(value) }) },
  },
  lifetimes: {
    attached() {
      this.setData({
        summary: describe(this.properties.payload),
        camel: describe(this.properties.isEnabled),
        unknownPresent: Object.prototype.hasOwnProperty.call(this.properties, 'unknown'),
      })
    },
  },
})`],
  ['components/probe.wxml', '<text class="bare-summary">{{summary}}</text><text class="camel-summary">{{camel}}</text><text class="unknown-summary">{{unknownPresent}}</text>'],
  ['components/behavior-probe.json', '{"component":true}'],
  ['components/behavior-probe.js', `
function describe(value) {
  return value === null ? 'null' : typeof value + ':' + String(value)
}
const inner = Behavior({
  properties: {
    payload: { type: null, value: 'nested-fallback', observer: 'record' },
    isEnabled: { type: null, value: false },
  },
})
const outer = Behavior({ behaviors: [inner] })
Component({
  behaviors: [outer],
  data: { summary: '', camel: '' },
  methods: {
    record(value) { this.setData({ summary: describe(value) }) },
  },
  lifetimes: {
    attached() {
      this.setData({
        summary: describe(this.properties.payload),
        camel: describe(this.properties.isEnabled),
      })
    },
  },
})`],
  ['components/behavior-probe.wxml', '<text class="bare-summary">{{summary}}</text><text class="camel-summary">{{camel}}</text>'],
]
