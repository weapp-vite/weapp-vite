export interface WxssTransformOptions {
  /**
   * How many CSS pixels should a single rpx represent.
   * Default approximates a 750rpx layout projected to 375px screens.
   */
  pxPerRpx?: number
}

export interface WxssTransformResult {
  css: string
}

const RPX_RE = /(-?(?:\d+(?:\.\d+)?|\.\d+))rpx/gi

export function transformWxssToCss(source: string, options?: WxssTransformOptions): WxssTransformResult {
  const ratio = options?.pxPerRpx ?? 0.5
  const css = source.replace(RPX_RE, (_, value: string) => {
    const numeric = Number.parseFloat(value)
    if (Number.isNaN(numeric)) {
      return `${value}px`
    }
    const converted = Math.round(numeric * ratio * 1000) / 1000
    return `${converted}px`
  })
  return {
    css,
  }
}
