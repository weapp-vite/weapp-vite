const componentMarker = 'STATEFUL-COMPONENT-BASE'

Component({
  data: {
    count: 0,
    input: '',
    marker: componentMarker,
    parentCount: 0,
  },
  methods: {
    incrementParent() {
      this.setData({ parentCount: this.data.parentCount + 1 })
    },
    onInput(event: WechatMiniprogram.Input) {
      this.setData({ input: event.detail.value })
    },
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})
