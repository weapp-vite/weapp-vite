import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance, resolveLayoutBridge } from 'wevu'

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

function resolveToastHost(selector: string, context?: any) {
  const resolvedContext = resolveLayoutBridge(selector, context ?? getCurrentInstance())
  const host = resolvedContext?.selectComponent?.(selector) ?? null
  return {
    context: resolvedContext,
    host,
  }
}

export function showToast(payload: string | ShowToastPayload, theme?: ToastTheme) {
  const mpContext = getCurrentInstance()
  const normalized = typeof payload === 'string'
    ? { message: payload, theme }
    : payload
  const selector = normalized.selector ?? '#t-toast'
  const { context, host } = resolveToastHost(selector, normalized.context ?? mpContext)

  if (!context) {
    return
  }

  const { theme: nextTheme, title, message, ...rest } = normalized
  const options = {
    message: message ?? title ?? '',
    ...rest,
    ...(nextTheme && nextTheme !== 'default' ? { theme: nextTheme } : {}),
  }

  if (host && typeof host.show === 'function') {
    host.show(options)
    return
  }

  return Toast({
    selector,
    context: context as any,
    ...options,
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
