Component({
  options: { virtualHost: true },
  properties: { value: Number },
  lifetimes: { detached() { getApp().globalData.genericDetached += 1 } },
  methods: { selected(event) { this.triggerEvent('pick', event.detail) } },
})
