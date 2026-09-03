Page({
  data: {
    asyncResult: '',
    runtimeGlobals: {
      btoa: typeof btoa,
      crypto: typeof crypto,
      CustomEvent: typeof CustomEvent,
      document: typeof document,
      Event: typeof Event,
      fetch: typeof fetch,
      global: typeof global,
      location: typeof location,
      navigator: typeof navigator,
      queueMicrotask: typeof queueMicrotask,
      self: typeof self,
      window: typeof window,
    },
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
