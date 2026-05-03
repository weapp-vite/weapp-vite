import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, resolveLayoutBridge, resolveLayoutHost } from 'wevu'
import { LAYOUT_DIALOG_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'

export interface DialogOptions {
  bridgeKey?: string
  context?: any
  selector?: string
}

interface BaseDialogPayload {
  bridgeKey?: string
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title: string
}

export interface AlertOptions extends BaseDialogPayload {}

export interface ConfirmOptions extends BaseDialogPayload {
  cancelBtn?: string
}

interface HostDialogInstance {
  _onCancel?: (reason?: unknown) => void
  _onConfirm?: (value?: unknown) => void
  close?: () => void
  setData?: (payload: Record<string, unknown>) => void
}

type DialogMode = 'alert' | 'confirm'

type ResolvedDialogPayload<T extends BaseDialogPayload> = Omit<T, 'bridgeKey' | 'context' | 'selector'>

function resolveDialogContext(options: DialogOptions) {
  return options.bridgeKey
    ? resolveLayoutBridge(options.bridgeKey, options.context ?? getCurrentInstance())
    : options.context ?? getCurrentInstance()
}

function resolveDialogHost(options: DialogOptions) {
  const bridgeKey = options.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const context = resolveDialogContext({
    bridgeKey,
    context: options.context,
  })
  const host = bridgeKey
    ? resolveLayoutHost<HostDialogInstance>(bridgeKey, { context })
    : options.selector
      ? context?.selectComponent?.(options.selector) ?? null
      : null

  return {
    context,
    host,
    selector: options.selector,
  }
}

function closeDialogHost(host: HostDialogInstance) {
  if (typeof host.close === 'function') {
    host.close()
    return
  }
  if (typeof host.setData === 'function') {
    host.setData({ visible: false })
  }
}

function attachHostDialogHandlers(
  host: HostDialogInstance,
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

function normalizeDialogPayload<T extends BaseDialogPayload>(
  mode: DialogMode,
  payload: T,
): ResolvedDialogPayload<T> {
  const { bridgeKey: _bridgeKey, context: _context, selector: _selector, ...rest } = payload

  if (mode === 'alert') {
    return {
      ...rest,
      cancelBtn: null,
    } as ResolvedDialogPayload<T>
  }

  return rest as ResolvedDialogPayload<T>
}

function openDialogWithHost<T extends BaseDialogPayload>(
  mode: DialogMode,
  host: HostDialogInstance,
  payload: ResolvedDialogPayload<T>,
) {
  return new Promise((resolve, reject) => {
    host.setData?.({
      ...payload,
      visible: true,
    })

    attachHostDialogHandlers(host, {
      onConfirm: resolve,
      ...(mode === 'confirm' ? { onCancel: reject } : {}),
    })
  })
}

function openDialog<T extends BaseDialogPayload>(mode: DialogMode, payload: T) {
  const bridgeKey = payload.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const { context, host, selector } = resolveDialogHost({
    bridgeKey,
    context: payload.context,
    selector: payload.selector,
  })

  if (!context) {
    return Promise.resolve()
  }

  const normalizedPayload = normalizeDialogPayload(mode, payload)

  if (host && typeof host.setData === 'function') {
    return openDialogWithHost(mode, host, normalizedPayload)
  }

  if (!selector) {
    return Promise.resolve()
  }

  const open = mode === 'alert' ? Dialog.alert : Dialog.confirm

  return open({
    selector,
    context: context as any,
    ...normalizedPayload,
  })
}

export function alertDialog(payload: AlertOptions) {
  return openDialog('alert', payload)
}

export function confirmDialog(payload: ConfirmOptions) {
  return openDialog('confirm', payload)
}

export function useDialog(options: DialogOptions = {}) {
  const bridgeKey = options.bridgeKey ?? LAYOUT_DIALOG_BRIDGE_KEY
  const context = options.context ?? getCurrentInstance()

  function withDefaults<T extends BaseDialogPayload>(payload: T): T {
    return {
      ...payload,
      bridgeKey,
      context: payload.context ?? context,
      selector: payload.selector ?? options.selector,
    }
  }

  return {
    alert(payload: AlertOptions) {
      return alertDialog(withDefaults(payload))
    },
    confirm(payload: ConfirmOptions) {
      return confirmDialog(withDefaults(payload))
    },
  }
}
