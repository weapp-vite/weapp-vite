export const initialPropertyDeliveryFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ globalData: { propertyEvents: [] } })'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'property-probe': '/components/probe/index' } })],
  ['pages/index/index.js', `Page({
    data: { first: 'OWNER', second: ['value', 'SLOT-READY'] },
    updateBoth() { this.setData({ first: 'OWNER-UPDATED', second: ['value', 'SLOT-UPDATED'] }) },
    writeSelf() { return this.selectComponent('#probe').writeSelf() },
  })`],
  ['pages/index/index.wxml', '<view class="probe-value">{{first}}:{{second[1]}}</view><property-probe id="probe" first="{{first}}" second="{{second}}" extra="attribute-extra" />'],
  ['components/probe/index.json', JSON.stringify({ component: true })],
  ['components/probe/index.js', `
function snapshot(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => item === undefined ? '[undefined]' : item))
}
function record(instance, event, args) {
  getApp().globalData.propertyEvents.push({
    event,
    args: snapshot(args || []),
    properties: snapshot(instance.properties),
    data: snapshot(instance.data),
    sameDataAndProperties: instance.data === instance.properties,
  })
}
Component({
  data: { local: 'local-data' },
  properties: {
    first: { type: String, value: '', observer(...args) { record(this, 'first', args) } },
    second: { type: null, value: null, observer(...args) { record(this, 'second', args) } },
  },
  observers: {
    first(...args) { record(this, 'data:first', args) },
    second(...args) { record(this, 'data:second', args) },
    'first,second'(...args) { record(this, 'data:first,second', args) },
  },
  lifetimes: {
    created() { record(this, 'created') },
    attached() { record(this, 'attached') },
    ready() { record(this, 'ready') },
  },
  methods: {
    async writeSelf() {
      record(this, 'self:before')
      this.data.first = 'SELF'
      record(this, 'self:direct-data')
      for (const [stage, first] of [['same-direct', 'SELF'], ['same-again', 'SELF'], ['changed', 'SELF-CHANGED']]) {
        await new Promise((resolve) => {
          record(this, 'self:' + stage + ':before')
          this.setData({ first }, () => {
            record(this, 'self:' + stage + ':callback')
            resolve()
          })
          record(this, 'self:' + stage + ':after')
        })
      }
    },
  },
})`],
  ['components/probe/index.wxml', '<view class="component-value">{{first}}:{{second[1]}}</view>'],
]
