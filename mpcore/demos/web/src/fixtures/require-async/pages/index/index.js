Page({
  data: {
    asyncResult: '',
  },
  async loadAsyncModule() {
    try {
      const moduleExport = await require.async('../../subpackages/async/target.js')
      this.setData({
        asyncResult: `${moduleExport.default}:${moduleExport.named}`,
      })
    }
    catch (error) {
      this.setData({
        asyncResult: `error:${error.message}`,
      })
    }
  },
})
