import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance, resolveLayoutBridge, resolveLayoutHost } from 'wevu'
import { LAYOUT_TOAST_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'

export type ToastTheme = 'success' | 'warning' | 'error' | 'default' | 'loading'

export interface ShowToastPayload {
  bridgeKey?: string
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
  bridgeKey?: string
  context?: any
  duration?: number
  selector?: string
  theme?: ToastTheme
}

function resolveToastContext(options: { bridgeKey?: string, context?: any }) {
  return options.bridgeKey
    ? resolveLayoutBridge(options.bridgeKey, options.context ?? getCurrentInstance())
    : options.context ?? getCurrentInstance()
}

export function showToast(payload: string | ShowToastPayload, theme?: ToastTheme) {
  const mpContext = getCurrentInstance()
  const normalized = typeof payload === 'string'
    ? { message: payload, theme }
    : payload
  const bridgeKey = normalized.bridgeKey ?? LAYOUT_TOAST_BRIDGE_KEY
  const selector = normalized.selector
  const {
    bridgeKey: _bridgeKey,
    context: _context,
    selector: _selector,
    theme: nextTheme,
    title,
    message,
    ...rest
  } = normalized
  const options = {
    message: message ?? title ?? '',
    ...rest,
    ...(nextTheme && nextTheme !== 'default' ? { theme: nextTheme } : {}),
  }
  const context = resolveToastContext({
    bridgeKey,
    context: normalized.context ?? mpContext,
  })
  const host = bridgeKey
    ? resolveLayoutHost<{
        show?: (payload: typeof options) => void
      }>(bridgeKey, { context })
    : selector
      ? context?.selectComponent?.(selector) ?? null
      : null
  if (!context) {
    return
  }
  if (host && typeof host.show === 'function') {
    host.show(options)
    return
  }
  if (!selector) {
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
  const bridgeKey = options.bridgeKey ?? LAYOUT_TOAST_BRIDGE_KEY
  const selector = options.selector
  const duration = options.duration ?? 2000
  const defaultTheme = options.theme

  return {
    showToast(message: string, theme: ToastTheme = defaultTheme ?? 'default') {
      return showToast({
        bridgeKey,
        context,
        selector,
        message,
        duration,
        ...(theme === 'default' ? {} : { theme }),
      })
    },
  }
}
