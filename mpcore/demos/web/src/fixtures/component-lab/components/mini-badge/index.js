Component({
  properties: {
    label: {
      type: String,
      value: 'badge'
    }
  },
  data: {
    ping: 'cold'
  },
  lifetimes: {
    created() {
      this.setData({
        ping: 'created'
      })
    },
    ready() {
      this.setData({
        ping: 'ready'
      })
    }
  }
})
