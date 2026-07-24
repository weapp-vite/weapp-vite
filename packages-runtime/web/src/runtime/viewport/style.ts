import type { ResolvedWebViewportConfig } from './types'

export const WEB_VIEWPORT_STYLE_ID = 'weapp-web-viewport-style'

export function createWebViewportStyle(config: ResolvedWebViewportConfig) {
  const maxWidth = `${config.maxWidth}px`
  const breakpoint = `${config.desktopBreakpoint}px`
  return `
:root {
  --weapp-viewport-width: 100vw;
  --weapp-viewport-max-width: ${maxWidth};
  --weapp-viewport-left: 0px;
  --weapp-viewport-right: 0px;
  --weapp-safe-area-inset-top: env(safe-area-inset-top, 0px);
  --weapp-safe-area-inset-right: env(safe-area-inset-right, 0px);
  --weapp-safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --weapp-safe-area-inset-left: env(safe-area-inset-left, 0px);
}

html,
body {
  min-width: 0;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background: #f2f2f2;
  font-family: Helvetica, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}

#app {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  overflow: auto;
  overscroll-behavior: contain;
  background: #ffffff;
  contain: layout paint;
  transform: translateZ(0);
}

@media (min-width: ${breakpoint}) {
  html[data-weapp-viewport-mode="mini-program"] {
    --weapp-viewport-width: ${maxWidth};
    --weapp-viewport-left: calc((100vw - ${maxWidth}) / 2);
    --weapp-viewport-right: calc((100vw - ${maxWidth}) / 2);
  }

  html[data-weapp-viewport-mode="mini-program"] #app {
    width: ${maxWidth};
  }
}
`
}
