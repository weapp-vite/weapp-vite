Page({
  data: {
    __e2eData: {
      greeting: 'Hello',
      target: 'index snapshot',
    },
    __e2eResult: {
      status: 'ready',
      detail: 'rendered',
    },
  },
  onTap() {
    this.setData({
      __e2eResult: {
        status: 'tapped',
        detail: 'tap handled',
      },
    })
  },
})
