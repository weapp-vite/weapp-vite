import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance } from 'wevu'

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
  context?: any
  duration?: number
  selector?: string
  theme?: ToastTheme
}

export function showToast(payload: string | ShowToastPayload, theme?: ToastTheme) {
  const mpContext = getCurrentInstance()
  const normalized = typeof payload === 'string'
    ? { message: payload, theme }
    : payload
  const context = normalized.context ?? mpContext

  if (!context) {
    return
  }

  const { selector = '#t-toast', theme: nextTheme, title, message, ...rest } = normalized
  return Toast({
    selector,
    context: context as any,
    message: message ?? title ?? '',
    ...rest,
    ...(nextTheme && nextTheme !== 'default' ? { theme: nextTheme } : {}),
  } as any)
}

export function useToast(options: ToastOptions = {}) {
  const context = options.context ?? getCurrentInstance()
  const selector = options.selector ?? '#t-toast'
  const duration = options.duration ?? 2000
  const defaultTheme = options.theme

  return {
    showToast(message: string, theme: ToastTheme = defaultTheme ?? 'default') {
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
