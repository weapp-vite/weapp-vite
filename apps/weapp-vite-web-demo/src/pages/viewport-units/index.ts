Page({
  async setViewport(mode: 'mini-program' | 'responsive', maxWidth = 375) {
    if (import.meta.env.IS_WEB) {
      const { setupWebViewport } = await import('@weapp-vite/web/runtime')
      setupWebViewport({ mode, maxWidth })
    }
  },
})
