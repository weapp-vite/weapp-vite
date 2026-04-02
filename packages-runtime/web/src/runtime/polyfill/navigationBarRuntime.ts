interface RuntimeWarningOptions {
  key: string
  context: string
}

type RuntimeWarningEmitter = (message: string, options: RuntimeWarningOptions) => void

interface PageLike extends HTMLElement {
  renderRoot?: ShadowRoot | HTMLElement
}

function getActiveNavigationBar(pages: PageLike[]) {
  const current = pages[pages.length - 1]
  if (!current) {
    return undefined
  }
  const renderRoot = current.renderRoot
    ?? current.shadowRoot
    ?? current
  if (!renderRoot || typeof (renderRoot as ParentNode).querySelector !== 'function') {
    return undefined
  }
  return (renderRoot as ParentNode).querySelector('weapp-navigation-bar') as HTMLElement | null
}

function warnNavigationBarMissing(emitWarning: RuntimeWarningEmitter, action: string) {
  emitWarning(`[@weapp-vite/web] ${action} 需要默认导航栏支持，但当前页面未渲染 weapp-navigation-bar。`, {
    key: 'navigation-bar-missing',
    context: 'runtime:navigation',
  })
}

export function createNavigationBarRuntimeBridge(
  getCurrentPages: () => PageLike[],
  emitWarning: RuntimeWarningEmitter,
) {
  return {
    setNavigationBarTitle(options: { title: string }) {
      const bar = getActiveNavigationBar(getCurrentPages())
      if (!bar) {
        warnNavigationBarMissing(emitWarning, 'wx.setNavigationBarTitle')
        return Promise.resolve()
      }
      if (options?.title !== undefined) {
        bar.setAttribute('title', options.title)
      }
      return Promise.resolve()
    },
    setNavigationBarColor(options: {
      frontColor?: string
      backgroundColor?: string
      animation?: { duration?: number, timingFunction?: string }
    }) {
      const bar = getActiveNavigationBar(getCurrentPages())
      if (!bar) {
        warnNavigationBarMissing(emitWarning, 'wx.setNavigationBarColor')
        return Promise.resolve()
      }
      if (options?.frontColor) {
        bar.setAttribute('front-color', options.frontColor)
      }
      if (options?.backgroundColor) {
        bar.setAttribute('background-color', options.backgroundColor)
      }
      if (options?.animation) {
        const duration = typeof options.animation.duration === 'number'
          ? `${options.animation.duration}ms`
          : undefined
        const easing = options.animation.timingFunction
        if (duration) {
          bar.style.setProperty('--weapp-nav-transition-duration', duration)
        }
        if (easing) {
          bar.style.setProperty('--weapp-nav-transition-easing', easing)
        }
      }
      return Promise.resolve()
    },
    showNavigationBarLoading() {
      const bar = getActiveNavigationBar(getCurrentPages())
      if (!bar) {
        warnNavigationBarMissing(emitWarning, 'wx.showNavigationBarLoading')
        return Promise.resolve()
      }
      bar.setAttribute('loading', 'true')
      return Promise.resolve()
    },
    hideNavigationBarLoading() {
      const bar = getActiveNavigationBar(getCurrentPages())
      if (!bar) {
        warnNavigationBarMissing(emitWarning, 'wx.hideNavigationBarLoading')
        return Promise.resolve()
      }
      bar.removeAttribute('loading')
      return Promise.resolve()
    },
  }
}
