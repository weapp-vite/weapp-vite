import { getCurrentInstance, resolveLayoutBridge, resolveLayoutHost } from 'wevu'

type FeedbackTheme = 'success' | 'warning' | 'error' | 'info'

interface FeedbackOptions {
  message: string
  theme?: FeedbackTheme
}

const LAYOUT_TOAST_HOST = 'layout-toast'
const LAYOUT_MESSAGE_HOST = 'layout-message'

function resolveBridge(key: string, context: any) {
  return resolveLayoutBridge(key, context ?? getCurrentInstance())
}

export function showLayoutToast(options: FeedbackOptions, context = getCurrentInstance()) {
  const bridge = resolveBridge(LAYOUT_TOAST_HOST, context)
  const host = resolveLayoutHost<{ show?: (payload: Record<string, unknown>) => void }>(LAYOUT_TOAST_HOST, { context: bridge })
  const payload = {
    message: options.message,
    duration: 1400,
    ...(options.theme && options.theme !== 'info' ? { theme: options.theme } : {}),
  }

  if (host?.show) {
    host.show(payload)
    return
  }

  wx.showToast({
    title: options.message,
    icon: 'none',
  })
}

export function showLayoutMessage(options: FeedbackOptions, context = getCurrentInstance()) {
  const bridge = resolveBridge(LAYOUT_MESSAGE_HOST, context)
  const theme = options.theme ?? 'info'
  const host = resolveLayoutHost<{ setMessage?: (payload: Record<string, unknown>, theme?: string) => void }>(LAYOUT_MESSAGE_HOST, { context: bridge })
  const payload = {
    content: options.message,
    duration: 1800,
    single: true,
  }

  if (host?.setMessage) {
    host.setMessage(payload, theme)
    return
  }

  wx.showToast({
    title: options.message,
    icon: 'none',
  })
}

export function useLayoutFeedback() {
  const context = getCurrentInstance()
  return {
    showMessage(message: string, theme: FeedbackTheme = 'info') {
      showLayoutMessage({ message, theme }, context)
    },
    showToast(message: string, theme: FeedbackTheme = 'success') {
      showLayoutToast({ message, theme }, context)
    },
  }
}
