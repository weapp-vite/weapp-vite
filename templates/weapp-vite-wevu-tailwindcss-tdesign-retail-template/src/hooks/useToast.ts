import Toast from 'tdesign-miniprogram/toast/index'
import { getCurrentInstance, resolveLayoutBridge } from 'wevu'
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

const HOST_RETRY_INTERVAL = 16
const HOST_RETRY_TIMES = 20

function resolveToastHost(options: { bridgeKey?: string, context?: any, selector?: string }) {
  const { bridgeKey, context, selector } = options
  const resolvedContext = bridgeKey
    ? resolveLayoutBridge(bridgeKey, context ?? getCurrentInstance())
    : context ?? getCurrentInstance()
  const host = bridgeKey
    ? resolvedContext?.selectComponent?.(bridgeKey) ?? resolvedContext?.selectComponent?.(selector) ?? null
    : selector
      ? resolvedContext?.selectComponent?.(selector) ?? null
      : null
  return {
    context: resolvedContext,
    host,
  }
}

function resolveToastHostWhenReady(
  options: { bridgeKey?: string, context?: any, selector?: string },
  remaining = HOST_RETRY_TIMES,
): Promise<ReturnType<typeof resolveToastHost>> {
  const resolved = resolveToastHost(options)
  if (resolved.host || !options.bridgeKey || options.selector || remaining <= 0) {
    return Promise.resolve(resolved)
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(resolveToastHostWhenReady(options, remaining - 1))
    }, HOST_RETRY_INTERVAL)
  })
}

export function showToast(payload: string | ShowToastPayload, theme?: ToastTheme) {
  const mpContext = getCurrentInstance()
  const normalized = typeof payload === 'string'
    ? { message: payload, theme }
    : payload
  const bridgeKey = normalized.bridgeKey ?? LAYOUT_TOAST_BRIDGE_KEY
  const selector = normalized.selector
  const hostOptions = {
    bridgeKey,
    selector,
    context: normalized.context ?? mpContext,
  }
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
  void resolveToastHostWhenReady(hostOptions).then(({ context, host }) => {
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
  })
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
