Component({
  data: {
    instanceId: 0,
    owner: '',
    taps: 0,
  },
  lifetimes: {
    attached() {
      const app = getApp()
      const instanceId = ++app.globalData.nextTabId
      app.globalData.attached.push(instanceId)
      this.setData({ instanceId })
    },
    detached() {
      getApp().globalData.detached.push(this.data.instanceId)
    },
  },
  methods: {
    switchTab(event) {
      this.setData({ taps: this.data.taps + 1 })
      wx.switchTab({ url: event.currentTarget.dataset.route })
    },
  },
})
