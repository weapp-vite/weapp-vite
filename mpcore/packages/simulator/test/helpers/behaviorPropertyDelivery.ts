export const behaviorPropertyDeliveryFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'property-probe': '/components/probe/index' } })],
  ['pages/index/index.js', `Page({
    data: { first: 'OWNER' },
    updateFirst() { this.setData({ first: 'OWNER-UPDATED' }) },
  })`],
  ['pages/index/index.wxml', '<property-probe id="probe" first="{{first}}" extra="host-extra" />'],
  ['components/probe/index.json', JSON.stringify({ component: true })],
  ['components/probe/index.js', `
const inheritedProperties = Behavior({ properties: { first: String } })
Component({
  behaviors: [inheritedProperties],
  data: { attachedFirst: '' },
  lifetimes: {
    attached() { this.setData({ attachedFirst: this.properties.first }) },
  },
  methods: { __weapp_vite_probe() {} },
})`],
  ['components/probe/index.wxml', '<view class="inherited-value">{{first}}:{{attachedFirst}}</view>'],
]
