import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, resolveLayoutBridge, resolveLayoutHost } from 'wevu'
import { LAYOUT_DIALOG_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'

export interface DialogOptions {
  bridgeKey?: string
  context?: any
  selector?: string
}

export interface AlertOptions {
  bridgeKey?: string
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title?: string
}

export interface ConfirmOptions {
  bridgeKey?: string
  cancelBtn?: string
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title?: string
}

function resolveDialogContext(options: { bridgeKey?: string, context?: any }) {
  return options.bridgeKey
    ? resolveLayoutBridge(options.bridgeKey, options.context ?? getCurrentInstance())
    : options.context ?? getCurrentInstance()
}

function closeDialogHost(host: any) {
  if (typeof host.close === 'function') {
    host.close()
    return
  }
  if (typeof host.setData === 'function') {
    host.setData({ visible: false })
  }
}

function attachHostDialogHandlers(
  host: any,
  handlers: {
    onCancel?: (reason?: unknown) => void
    onConfirm?: (value?: unknown) => void
  },
) {
  const originalConfirm = typeof host._onConfirm === 'function' ? host._onConfirm : undefined
  const originalCancel = typeof host._onCancel === 'function' ? host._onCancel : undefined

  host._onConfirm = (value?: unknown) => {
    host._onConfirm = originalConfirm
    host._onCancel = originalCancel
    if (originalConfirm) {
      originalConfirm.call(host, value)
    }
    else {
      closeDialogHost(host)
    }
    handlers.onConfirm?.(value)
  }

  host._onCancel = (reason?: unknown) => {
    host._onConfirm = originalConfirm
    host._onCancel = originalCancel
    if (originalCancel) {
      originalCancel.call(host, reason)
    }
    else {
      closeDialogHost(host)
    }
    handlers.onCancel?.(reason)
  }
}

function openAlertWithHost(host: any, payload: AlertOptions) {
  return new Promise((resolve) => {
    host.setData({
      ...host.properties,
      ...payload,
      cancelBtn: '',
      visible: true,
    })
    attachHostDialogHandlers(host, {
      onConfirm: resolve,
    })
  })
}

function openConfirmWithHost(host: any, payload: ConfirmOptions) {
  return new Promise((resolve, reject) => {
    host.setData({
      ...host.properties,
      ...payload,
      visible: true,
    })
    attachHostDialogHandlers(host, {
      onConfirm: resolve,
      onCancel: reject,
    })
  })
}

export function alertDialog(payload: AlertOptions) {
  const bridgeKey = payload.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const selector = payload.selector
  const context = resolveDialogContext({
    bridgeKey,
    context: payload.context,
  })
  if (!context) {
    return Promise.resolve()
  }
  const host = bridgeKey
    ? resolveLayoutHost<{
        _onCancel?: (reason?: unknown) => void
        _onConfirm?: (value?: unknown) => void
        close?: () => void
        properties?: Record<string, unknown>
        setData?: (payload: Record<string, unknown>) => void
      }>(bridgeKey, { context })
    : selector
      ? context?.selectComponent?.(selector) ?? null
      : null
  const { bridgeKey: _bridgeKey, context: _context, selector: _selector, ...rest } = payload
  if (host && typeof host.setData === 'function') {
    return openAlertWithHost(host, rest)
  }
  if (!selector) {
    return Promise.resolve()
  }
  return Dialog.alert({
    selector,
    context: context as any,
    ...rest,
  })
}

export function confirmDialog(payload: ConfirmOptions) {
  const bridgeKey = payload.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const selector = payload.selector
  const context = resolveDialogContext({
    bridgeKey,
    context: payload.context,
  })
  if (!context) {
    return Promise.resolve()
  }
  const host = bridgeKey
    ? resolveLayoutHost<{
        _onCancel?: (reason?: unknown) => void
        _onConfirm?: (value?: unknown) => void
        close?: () => void
        properties?: Record<string, unknown>
        setData?: (payload: Record<string, unknown>) => void
      }>(bridgeKey, { context })
    : selector
      ? context?.selectComponent?.(selector) ?? null
      : null
  const { bridgeKey: _bridgeKey, context: _context, selector: _selector, ...rest } = payload
  if (host && typeof host.setData === 'function') {
    return openConfirmWithHost(host, rest)
  }
  if (!selector) {
    return Promise.resolve()
  }
  return Dialog.confirm({
    selector,
    context: context as any,
    ...rest,
  })
}

export function useDialog(options: DialogOptions = {}) {
  const bridgeKey = options.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const context = options.context ?? getCurrentInstance()
  return {
    alert(payload: AlertOptions) {
      return alertDialog({
        bridgeKey,
        ...payload,
        context: payload.context ?? context,
        selector: payload.selector ?? options.selector,
      })
    },
    confirm(payload: ConfirmOptions) {
      return confirmDialog({
        bridgeKey,
        ...payload,
        context: payload.context ?? context,
        selector: payload.selector ?? options.selector,
      })
    },
  }
}
