import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance } from 'wevu'

export type ToastTheme = 'success' | 'warning' | 'error' | 'default' | 'loading'

export interface ToastOptions {
  selector?: string
  duration?: number
  theme?: ToastTheme
}

export function useToast(options: ToastOptions = {}) {
  const mpContext = getCurrentInstance()
  const selector = options.selector ?? '#t-toast'
  const duration = options.duration ?? 1200
  const defaultTheme = options.theme ?? 'success'

  function showToast(message: string, theme: ToastTheme = defaultTheme) {
    if (!mpContext) {
      return
    }
    Toast({
      selector,
      context: mpContext as any,
      message,
      theme,
      duration,
    })
  }

  return {
    showToast,
  }
}
