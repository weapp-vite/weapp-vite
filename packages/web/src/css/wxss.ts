export interface WxssTransformOptions {
  /**
   * How many CSS pixels should a single rpx represent.
   * Default approximates a 750rpx layout projected to 375px screens.
   */
  pxPerRpx?: number
  /**
   * Design width for rpx conversion. When provided, rpx is converted into
   * `calc(var(--rpx) * N)` to enable responsive sizing.
   */
  designWidth?: number
  /**
   * CSS variable name used to store the runtime rpx size.
   * @default "--rpx"
   */
  rpxVar?: string
}

export interface WxssTransformResult {
  css: string
}

const RPX_RE = /(-?(?:\d+(?:\.\d+)?|\.\d+))rpx/gi

export function transformWxssToCss(source: string, options?: WxssTransformOptions): WxssTransformResult {
  const rpxVar = options?.rpxVar ?? '--rpx'
  const useVariable = typeof options?.designWidth === 'number' && Number.isFinite(options.designWidth)
  const ratio = options?.pxPerRpx ?? 0.5
  const css = source.replace(RPX_RE, (_, value: string) => {
    const numeric = Number.parseFloat(value)
    if (Number.isNaN(numeric)) {
      return `${value}px`
    }
    if (useVariable) {
      return `calc(var(${rpxVar}) * ${numeric})`
    }
    const converted = Math.round(numeric * ratio * 1000) / 1000
    return `${converted}px`
  })
  return {
    css,
  }
}
