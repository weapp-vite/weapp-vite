/**
 * 内联 `style` 的小程序单位换算。
 *
 * WXSS 文件里的 `rpx` / `vw` / `vh` 走 postcss 链路转换，但直接写在 WXML
 * `style` 属性上的样式不经过那条链路：浏览器不认识 `rpx`，会整条丢弃声明，
 * 导致容器高度塌陷、卡片尺寸错乱等静默问题。
 *
 * 这里按与 WXSS 一致的语义在运行时替换：
 * - `Nrpx` → `calc(var(--rpx) * N)`（runtime rpx 变量模式）
 * - `Nrpx` → `N * (视口宽度 / 750)px`（静态 pxPerRpx 模式）
 * - `Nvw`  → `calc(var(--weapp-viewport-width, 100vw) * N / 100)`
 * - `Nvh`  → `calc(var(--weapp-viewport-height, 100dvh) * N / 100)`
 * - `env(safe-area-inset-*)` → `var(--weapp-safe-area-inset-*)`
 */

import { getWebViewportWidth } from './viewport'

const DEFAULT_DESIGN_WIDTH = 750
const RPX_RE = /(-?(?:\d+(?:\.\d+)?|\.\d+))rpx/gi
const SAFE_AREA_ENV_RE = /env\(\s*safe-area-inset-(top|right|bottom|left)(?:\s*,[^)]*)?\)/gi
const VIEWPORT_UNIT_RE = /(-?(?:\d+(?:\.\d+)?|\.\d+))(vw|vh|vmin|vmax)\b/gi
const NEEDS_TRANSFORM_RE = /rpx|vw|vh|vmin|vmax|safe-area-inset/i

const FALLBACK_VIEWPORT_WIDTH = '100vw'
const FALLBACK_VIEWPORT_HEIGHT = '100dvh'

/**
 * `rpx` 在 runtime 变量模式下由 `--rpx` 驱动；静态 `pxPerRpx` 模式下运行时不会
 * 注入该变量，此时退化为按视口宽度等比折算，与 WXSS 的默认换算保持一致。
 */
let runtimeRpxVar: string | undefined | null = null

function detectRuntimeRpxVar() {
  if (runtimeRpxVar !== null) {
    return runtimeRpxVar
  }
  if (typeof document === 'undefined' || !document.documentElement) {
    // 无 DOM 环境（SSR / 单测）下按 runtime 变量模式输出，保留语义。
    runtimeRpxVar = '--rpx'
    return runtimeRpxVar
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue('--rpx').trim()
  runtimeRpxVar = value ? '--rpx' : undefined
  return runtimeRpxVar
}

/** 视口尺寸或根变量变化后清空缓存，让下次换算重新探测。 */
export function resetInlineStyleUnitCache() {
  runtimeRpxVar = null
}

function resolveViewportUnitBase(unit: string) {
  const width = `var(--weapp-viewport-width, ${FALLBACK_VIEWPORT_WIDTH})`
  const height = `var(--weapp-viewport-height, ${FALLBACK_VIEWPORT_HEIGHT})`
  switch (unit) {
    case 'vw':
      return width
    case 'vh':
      return height
    case 'vmin':
      return `min(${width}, ${height})`
    default:
      return `max(${width}, ${height})`
  }
}

/**
 * 把不需要换算的片段（`url(...)` 内容、引号字符串）切出来，
 * 避免文件名或文案里的 `10rpx` 被误改。
 */
function splitProtectedSegments(value: string) {
  const segments: Array<{ text: string, transformable: boolean }> = []
  let buffer = ''
  let index = 0
  const pushBuffer = (transformable: boolean) => {
    if (buffer) {
      segments.push({ text: buffer, transformable })
      buffer = ''
    }
  }
  while (index < value.length) {
    const char = value[index]!
    if (char === '"' || char === '\'') {
      pushBuffer(true)
      let end = index + 1
      while (end < value.length && value[end] !== char) {
        end += value[end] === '\\' ? 2 : 1
      }
      segments.push({ text: value.slice(index, end + 1), transformable: false })
      index = end + 1
      continue
    }
    if ((char === 'u' || char === 'U') && /^url\(/i.test(value.slice(index, index + 4))) {
      pushBuffer(true)
      let depth = 0
      let end = index + 3
      for (; end < value.length; end += 1) {
        const inner = value[end]!
        if (inner === '(') {
          depth += 1
        }
        else if (inner === ')') {
          depth -= 1
          if (depth === 0) {
            break
          }
        }
      }
      segments.push({ text: value.slice(index, end + 1), transformable: false })
      index = end + 1
      continue
    }
    buffer += char
    index += 1
  }
  pushBuffer(true)
  return segments
}

function transformViewportUnits(value: string) {
  return value.replace(VIEWPORT_UNIT_RE, (matched, raw: string, rawUnit: string) => {
    const numeric = Number.parseFloat(raw)
    if (!Number.isFinite(numeric)) {
      return matched
    }
    if (numeric === 0) {
      return '0px'
    }
    const base = resolveViewportUnitBase(rawUnit.toLowerCase())
    return numeric === 100 ? base : `calc(${base} * ${numeric} / 100)`
  })
}

function transformRpx(value: string) {
  const rpxVar = detectRuntimeRpxVar()
  const fallbackRatio = rpxVar ? 0 : getWebViewportWidth() / DEFAULT_DESIGN_WIDTH
  return value.replace(RPX_RE, (matched, raw: string) => {
    const numeric = Number.parseFloat(raw)
    if (!Number.isFinite(numeric)) {
      return matched
    }
    if (numeric === 0) {
      return '0px'
    }
    if (rpxVar) {
      return `calc(var(${rpxVar}) * ${numeric})`
    }
    if (!fallbackRatio) {
      // 静态 rpx 模式但拿不到视口宽度时，退化为变量写法，避免算出 0px。
      return `calc(var(--rpx) * ${numeric})`
    }
    const converted = Math.round(numeric * fallbackRatio * 1000) / 1000
    return `${converted}px`
  })
}

/**
 * 把内联样式值里的小程序单位换算成浏览器可识别的 CSS。
 *
 * 只处理完整的 dimension token，`url(...)` 内容、字符串字面量与标识符保持原值；
 * 重复调用结果稳定。
 */
export function transformInlineStyle(value: string) {
  if (typeof value !== 'string' || value.length === 0) {
    return value
  }
  if (!NEEDS_TRANSFORM_RE.test(value)) {
    return value
  }
  const converted = splitProtectedSegments(value)
    .map((segment) => {
      if (!segment.transformable) {
        return segment.text
      }
      return transformViewportUnits(transformRpx(segment.text))
    })
    .join('')
  return converted.replace(
    SAFE_AREA_ENV_RE,
    (_, side: string) => `var(--weapp-safe-area-inset-${side})`,
  )
}

/**
 * 内联样式在运行时可能以字符串、对象（`{ height: '20rpx' }`）或数组给出，
 * 这里统一处理并归一化成字符串。
 */
export function transformInlineStyleValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return transformInlineStyle(value)
  }
  if (Array.isArray(value)) {
    return value
      .map(item => String(transformInlineStyleValue(item) ?? ''))
      .filter(Boolean)
      .join(' ')
  }
  if (value && typeof value === 'object') {
    const parts: string[] = []
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === null || item === undefined || item === false) {
        continue
      }
      const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
      parts.push(`${cssKey}:${String(transformInlineStyleValue(item))}`)
    }
    return parts.join(';')
  }
  return value
}
