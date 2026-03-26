Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    status: {
      type: String,
      value: 'idle'
    },
    title: {
      type: String,
      value: 'Status card'
    }
  },
  data: {
    internalClicks: 0,
    observerLog: 'cold'
  },
  observers: {
    count() {
      this.setData({
        observerLog: `count:${this.properties.count}`
      })
    }
  },
  lifetimes: {
    attached() {
      this.setData({
        observerLog: `attached:${this.properties.count}`
      })
    },
    detached() {
      this.setData({
        observerLog: 'detached'
      })
    }
  },
  methods: {
    pulse() {
      this.setData({
        internalClicks: this.data.internalClicks + 1
      }, () => {
        this.triggerEvent('pulse', {
          phase: `pulse-${this.data.internalClicks}`,
          count: this.properties.count
        })
      })
    }
  }
})
