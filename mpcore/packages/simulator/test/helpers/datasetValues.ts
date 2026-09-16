export const datasetValueFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"value-card":"/components/value-card"}}'],
  ['pages/index/index.js', `Page({
  data: {
    values: ['first', 'second'],
    nativeCapture: null,
    componentCapture: null,
    selectorDataset: null,
    videoCapture: null,
  },
  captureNative(event) {
    this.setData({
      nativeCapture: {
        currentTarget: event.currentTarget.dataset,
        target: event.target.dataset,
      },
    })
  },
  captureComponent(event) {
    this.setData({
      componentCapture: {
        currentTarget: event.currentTarget.dataset,
        target: event.target.dataset,
      },
    })
  },
  captureVideo(event) {
    this.setData({ videoCapture: event.currentTarget.dataset })
  },
  playVideo() {
    wx.createVideoContext('typed-video', this).play()
  },
  readSelectorDataset() {
    wx.createSelectorQuery().select('#native-0').fields({ dataset: true }, (result) => {
      this.setData({ selectorDataset: result.dataset })
    }).exec()
  },
})`],
  ['pages/index/index.wxml', '<button wx:for="{{values}}" wx:for-item="value" wx:for-index="index" id="native-{{index}}" data-index="{{index}}" data-literal-index="0" bindtap="captureNative">{{value}}</button><value-card data-index="{{values.length}}" data-literal-index="0" bind:select="captureComponent" /><video id="typed-video" data-index="{{values.length}}" data-literal-index="0" bindplay="captureVideo" />'],
  ['components/value-card.json', '{"component":true}'],
  ['components/value-card.js', 'Component({methods:{emit(){this.triggerEvent("select")}}})'],
  ['components/value-card.wxml', '<button id="component-native" bindtap="emit">component</button>'],
]
