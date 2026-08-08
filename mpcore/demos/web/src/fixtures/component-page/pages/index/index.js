Component({
  data() {
    return {
      lifecycleLog: [],
      snapshot: '',
    }
  },
  lifetimes: {
    created() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'created'],
      })
    },
    attached() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'attached'],
      })
    },
    ready() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'ready'],
      })
    },
  },
  pageLifetimes: {
    show() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'show'],
      })
    },
    hide() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'hide'],
      })
    },
    resize(options) {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, `resize:${options.size.windowWidth}`],
      })
    },
    routeDone(options) {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, `routeDone:${options.from}`],
      })
    },
  },
  methods: {
    onLoad() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'load'],
      })
    },
    snapshotLifecycle() {
      this.setData({
        snapshot: this.data.lifecycleLog.join('|'),
      })
    },
    openNext() {
      wx.navigateTo({
        url: '/pages/next/index',
      })
    },
  },
})
