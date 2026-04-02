export interface WxssTransformOptions {
  /**
   * 1rpx 对应的 CSS 像素数。
   * 默认值近似于 750rpx 设计稿在 375px 屏幕上的换算。
   */
  pxPerRpx?: number
  /**
   * rpx 换算的设计宽度。传入后会把 rpx 转为
   * `calc(var(--rpx) * N)` 以实现响应式缩放。
   */
  designWidth?: number
  /**
   * 用于存储运行时 rpx 大小的 CSS 变量名。
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
