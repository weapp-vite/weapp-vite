import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance, resolvePageFeedbackHost } from 'wevu'

export type ToastTheme = 'success' | 'warning' | 'error' | 'default' | 'loading'

export interface ShowToastPayload {
  context?: any
  duration?: number
  icon?: string
  message?: string
  placement?: string
  selector?: string
  theme?: ToastTheme
  title?: string
}

export interface ToastOptions {
  selector?: string
  duration?: number
  theme?: ToastTheme
}

export function showToast(payload: string | ShowToastPayload, theme?: ToastTheme) {
  const mpContext = getCurrentInstance()
  const normalized = typeof payload === 'string'
    ? { message: payload, theme }
    : payload
  const selector = normalized.selector ?? '#t-toast'

  const context = resolvePageFeedbackHost(selector, normalized.context ?? mpContext)
  if (!context) {
    return
  }

  const { theme: nextTheme, title, message, ...rest } = normalized
  Toast({
    selector,
    context: context as any,
    message: message ?? title ?? '',
    ...rest,
    ...(nextTheme && nextTheme !== 'default' ? { theme: nextTheme } : {}),
  } as any)
}

export function useToast(options: ToastOptions = {}) {
  const context = getCurrentInstance()
  const selector = options.selector ?? '#t-toast'
  const duration = options.duration ?? 1200
  const defaultTheme = options.theme ?? 'success'

  return {
    showToast(message: string, theme: ToastTheme = defaultTheme) {
      return showToast({
        context,
        selector,
        message,
        duration,
        ...(theme === 'default' ? {} : { theme }),
      })
    },
  }
}
