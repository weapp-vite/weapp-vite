import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { resolveNativeComponentWebTag } from '../shared/nativeComponents'

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
const SAFE_AREA_ENV_RE = /env\(\s*safe-area-inset-(top|right|bottom|left)(?:\s*,[^)]*)?\)/gi

function transformWxssSelector(selector: string) {
  return selectorParser((selectors) => {
    selectors.walkTags((tag) => {
      if (tag.value === 'page') {
        tag.replaceWith(selectorParser.pseudo({ value: ':host' }))
        return
      }
      const webTag = resolveNativeComponentWebTag(tag.value)
      if (webTag) {
        tag.value = webTag
      }
    })
  }).processSync(selector)
}

function transformWxssSelectors(source: string) {
  const root = postcss.parse(source)
  root.walkRules((rule) => {
    if (rule.selector) {
      rule.selector = transformWxssSelector(rule.selector)
    }
  })
  root.walkDecls((declaration) => {
    declaration.value = declaration.value.replace(
      SAFE_AREA_ENV_RE,
      (_, side: string) => `var(--weapp-safe-area-inset-${side})`,
    )
  })
  return root.toString()
}

export function transformWxssToCss(source: string, options?: WxssTransformOptions): WxssTransformResult {
  const rpxVar = options?.rpxVar ?? '--rpx'
  const useVariable = options?.pxPerRpx === undefined
    || (typeof options.designWidth === 'number' && Number.isFinite(options.designWidth))
  const ratio = options?.pxPerRpx ?? 0.5
  const css = transformWxssSelectors(source).replace(RPX_RE, (_, value: string) => {
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
