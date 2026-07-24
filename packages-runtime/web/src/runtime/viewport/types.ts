export interface WebViewportConfig {
  mode?: 'mini-program' | 'responsive'
  maxWidth?: number
  desktopBreakpoint?: number
}

export interface ResolvedWebViewportConfig {
  mode: 'mini-program' | 'responsive'
  maxWidth: number
  desktopBreakpoint: number
}
