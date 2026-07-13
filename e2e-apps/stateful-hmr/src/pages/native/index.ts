const nativeMarker = 'STATEFUL-NATIVE-BASE'

Page({
  data: {
    count: 0,
    input: '',
    marker: nativeMarker,
  },
  increment() {
    this.setData({ count: this.data.count + 1 })
  },
  onInput(event: WechatMiniprogram.Input) {
    this.setData({ input: event.detail.value })
  },
})
