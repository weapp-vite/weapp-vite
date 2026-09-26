export const componentTransitionFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ globalData: { events: [] } })'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { dialog: '/components/dialog' } })],
  ['pages/index/index.js', `Page({ data: { label: 'initial', unrelated: 0 } })`],
  ['pages/index/index.wxml', '<dialog id="dialog" label="{{label}}" />'],
  ['components/dialog.json', '{"component":true}'],
  ['components/dialog.js', `
const transition = Behavior({
  properties: { visible: { type: Boolean, observer: 'watchVisible' } },
  data: { realVisible: false },
  created() { getApp().globalData.events.push('behavior-created') },
  attached() { this.inited = true; getApp().globalData.events.push('behavior-attached') },
  detached() { getApp().globalData.events.push('behavior-detached') },
  methods: {
    watchVisible(value, oldValue) {
      getApp().globalData.events.push('visible:' + oldValue + ':' + value)
      if (this.inited) this.setData({ realVisible: value })
    },
  },
})
Component({
  behaviors: [transition],
  properties: { label: String },
  data: { renderedLabel: '' },
  observers: {
    label(value) { this.setData({ renderedLabel: value }) },
  },
  lifetimes: {
    created() { getApp().globalData.events.push('component-created') },
    attached() { getApp().globalData.events.push('component-attached') },
    detached() { getApp().globalData.events.push('component-detached') },
  },
  methods: { close() { this.setData({ visible: false }) } },
})
`],
  ['components/dialog.wxml', '<view wx:if="{{realVisible}}"><text id="dialog-title">{{renderedLabel}}</text><button id="dialog-close" bindtap="close">close</button></view>'],
]
