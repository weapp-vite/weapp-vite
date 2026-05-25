Page({
  data: {
    __e2eResult: {
      status: 'ready',
      entry: 'profile',
      from: '',
    },
  },
  onLoad(query) {
    this.setData({
      __e2eResult: {
        status: 'loaded',
        entry: 'profile',
        from: query.from || '',
      },
    })
  },
})
