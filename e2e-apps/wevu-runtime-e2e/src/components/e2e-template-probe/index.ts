Component({
  properties: {
    marker: {
      type: String,
      value: '',
      observer() {
        this.writeProbe()
      },
    },
    storageKey: {
      type: String,
      value: '',
      observer() {
        this.writeProbe()
      },
    },
  },
  lifetimes: {
    attached() {
      this.writeProbe()
    },
  },
  methods: {
    writeProbe() {
      const storageKey = String(this.data.storageKey || '')
      if (!storageKey || typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
        return
      }
      wx.setStorageSync(storageKey, {
        marker: String(this.data.marker || ''),
        updatedAt: Date.now(),
      })
    },
  },
})
