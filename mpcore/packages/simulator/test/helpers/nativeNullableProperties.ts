export const nativeNullablePropertiesFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"nullable-probe":"/components/probe"}}'],
  ['pages/index/index.js', `Page({
    data: { payload: null, include: false },
    update(payload) { this.setData({ payload }) },
    includeBound(include) { this.setData({ include }) },
  })`],
  ['pages/index/index.wxml', '<nullable-probe id="omitted" /><nullable-probe id="explicit" payload="{{payload}}" /><nullable-probe id="bound-undefined" payload="{{include ? payload : missing}}" />'],
  ['components/probe.json', '{"component":true}'],
  ['components/probe.js', `
function describe(value) {
  return value === null ? 'null' : typeof value + ':' + String(value)
}
Component({
  properties: { payload: { type: null, value: 'fallback', observer: 'record' } },
  data: { summary: '', history: [] },
  methods: {
    record(value) {
      this.setData({ summary: describe(value), history: this.data.history.concat(describe(value)) })
    },
  },
  lifetimes: {
    attached() { this.setData({ summary: describe(this.properties.payload) }) },
  },
})`],
  ['components/probe.wxml', '<text class="nullable-summary">{{summary}}</text>'],
]
