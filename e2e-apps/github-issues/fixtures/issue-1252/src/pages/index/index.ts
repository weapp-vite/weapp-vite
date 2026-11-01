let signatureContext: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D | undefined

Page({
  data: { enabled: true, triggered: false, animated: true, top: 0, defaultStyle: 'black', trace: '[]', touchTrace: '[]', reenter: false, canvasTrace: '[]', canvasEnd: '[]', canvasParents: 0, legacyStart: '[]', legacyEnd: '[]', legacyParents: 0 },
  onReady() {
    const legacy = wx.createCanvasContext('legacy-signature')
    legacy.setFillStyle('#559242')
    legacy.fillRect(10, 10, 40, 40)
    legacy.draw()
    wx.createSelectorQuery().select('#signature').fields({ node: true, size: true }).exec((results) => {
      const canvas = results[0]?.node
      if (canvas) {
        canvas.width = 300
        canvas.height = 100
        const context = canvas.getContext('2d')
        signatureContext = context
        context.fillStyle = '#b6843d'
        context.fillRect(10, 10, 40, 40)
        context.strokeStyle = '#183a66'
        context.lineWidth = 4
      }
    })
  },
  record(event: WechatMiniprogram.CustomEvent) {
    const trace = JSON.parse(this.data.trace) as Array<{ type: string }>
    if (event.type === 'refresherpulling' && trace.at(-1)?.type === event.type) {
      trace.pop()
    }
    trace.push({ type: event.type, detail: event.detail, triggered: this.data.triggered })
    this.setData({ trace: JSON.stringify(trace) })
    if (event.type === 'refresherrestore' && this.data.reenter) {
      this.setData({ reenter: false, triggered: true })
    }
  },
  touch(event: WechatMiniprogram.TouchEvent) {
    const trace = JSON.parse(this.data.touchTrace) as unknown[]
    trace.push({ type: event.type, touches: event.touches, changedTouches: event.changedTouches })
    this.setData({ touchTrace: JSON.stringify(trace) })
  },
  trigger() { this.setData({ triggered: true }) },
  restore() { this.setData({ triggered: false }) },
  reset() { this.setData({ trace: '[]', touchTrace: '[]' }) },
  disable() { this.setData({ enabled: !this.data.enabled }) },
  reenter() { this.setData({ reenter: true }) },
  scrollDown() { this.setData({ top: 300 }) },
  scrollUp() { this.setData({ top: 0 }) },
  customAppearance() { this.setData({ defaultStyle: 'none' }) },
  canvasTouch(event: WechatMiniprogram.TouchEvent) {
    const point = event.touches[0] as (WechatMiniprogram.Touch & { x: number, y: number }) | undefined
    if (point && signatureContext) {
      if (event.type === 'touchstart') {
        signatureContext.beginPath()
        signatureContext.moveTo(point.x, point.y)
      }
      else if (event.type === 'touchmove') {
        signatureContext.lineTo(point.x, point.y)
        signatureContext.stroke()
      }
    }
    const value = JSON.stringify({ type: event.type, targetId: event.target?.id, currentTarget: event.currentTarget, touches: event.touches, changedTouches: event.changedTouches })
    this.setData(event.type === 'touchend' ? { canvasEnd: value } : { canvasTrace: value })
  },
  canvasParent() { this.setData({ canvasParents: this.data.canvasParents + 1 }) },
  legacyTouch(event: WechatMiniprogram.TouchEvent) {
    const value = JSON.stringify({ type: event.type, targetId: event.target?.id, currentTarget: event.currentTarget, touches: event.touches, changedTouches: event.changedTouches })
    this.setData(event.type === 'touchend' ? { legacyEnd: value } : { legacyStart: value })
  },
  legacyParent() { this.setData({ legacyParents: this.data.legacyParents + 1 }) },
})
