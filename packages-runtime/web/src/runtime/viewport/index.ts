import type { ResolvedWebViewportConfig, WebViewportConfig } from './types'
import { createWebViewportStyle, WEB_VIEWPORT_STYLE_ID } from './style'

const DEFAULT_VIEWPORT_CONFIG: ResolvedWebViewportConfig = {
  mode: 'mini-program',
  maxWidth: 375,
  desktopBreakpoint: 600,
}

let resolvedConfig = { ...DEFAULT_VIEWPORT_CONFIG }

function resolvePositiveNumber(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function resolveWebViewportConfig(config?: WebViewportConfig): ResolvedWebViewportConfig {
  return {
    mode: config?.mode === 'responsive' ? 'responsive' : 'mini-program',
    maxWidth: resolvePositiveNumber(config?.maxWidth, DEFAULT_VIEWPORT_CONFIG.maxWidth),
    desktopBreakpoint: resolvePositiveNumber(config?.desktopBreakpoint, DEFAULT_VIEWPORT_CONFIG.desktopBreakpoint),
  }
}

export function setupWebViewport(config?: WebViewportConfig) {
  resolvedConfig = resolveWebViewportConfig(config)
  if (typeof document === 'undefined') {
    return resolvedConfig
  }
  document.documentElement?.setAttribute('data-weapp-viewport-mode', resolvedConfig.mode)
  let style = document.querySelector(`#${WEB_VIEWPORT_STYLE_ID}`) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = WEB_VIEWPORT_STYLE_ID
    document.head?.append(style)
  }
  style.textContent = createWebViewportStyle(resolvedConfig)
  return resolvedConfig
}

export function getWebViewportWidth() {
  if (typeof document === 'undefined') {
    return 0
  }
  const container = document.querySelector('#app') as HTMLElement | null
  const containerWidth = container?.clientWidth ?? 0
  if (containerWidth > 0) {
    return containerWidth
  }
  const documentWidth = document.documentElement?.clientWidth ?? 0
  if (resolvedConfig.mode === 'mini-program' && documentWidth >= resolvedConfig.desktopBreakpoint) {
    return Math.min(documentWidth, resolvedConfig.maxWidth)
  }
  return documentWidth || (typeof window !== 'undefined' ? window.innerWidth : 0)
}

export type { ResolvedWebViewportConfig, WebViewportConfig } from './types'
