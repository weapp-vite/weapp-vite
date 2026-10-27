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

export interface ResolvedStyleUnitOptions {
  useVariable: boolean
  rpxVar: string
  ratio: number
  designWidth: number
}

/** 编译端与运行时共用显式配置；有限设计宽度优先启用变量模式。 */
export function resolveStyleUnitOptions(options?: WxssTransformOptions): ResolvedStyleUnitOptions {
  return {
    useVariable: options?.pxPerRpx === undefined
      || (typeof options.designWidth === 'number' && Number.isFinite(options.designWidth)),
    rpxVar: options?.rpxVar ?? '--rpx',
    ratio: options?.pxPerRpx ?? 0.5,
    designWidth: options?.designWidth ?? 750,
  }
}
