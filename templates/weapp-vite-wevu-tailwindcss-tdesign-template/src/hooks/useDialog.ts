import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, resolveLayoutBridge } from 'wevu'

export interface DialogOptions {
  context?: any
  selector?: string
}

export interface AlertOptions {
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title: string
}

export interface ConfirmOptions {
  cancelBtn?: string
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title: string
}

function resolveDialogContext(selector: string, context?: any) {
  const resolvedContext = resolveLayoutBridge(selector, context ?? getCurrentInstance())
  return {
    context: resolvedContext,
    host: resolvedContext?.selectComponent?.(selector) ?? null,
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
    host._onConfirm = resolve
  })
}

function openConfirmWithHost(host: any, payload: ConfirmOptions) {
  return new Promise((resolve, reject) => {
    host.setData({
      ...host.properties,
      ...payload,
      visible: true,
    })
    host._onConfirm = resolve
    host._onCancel = reject
  })
}

export function alertDialog(payload: AlertOptions) {
  const selector = payload.selector ?? '#t-dialog'
  const { context, host } = resolveDialogContext(selector, payload.context)
  if (!context) {
    return
  }
  const { ...rest } = payload
  if (host && typeof host.setData === 'function') {
    return openAlertWithHost(host, rest)
  }
  return Dialog.alert({
    selector,
    context: context as any,
    ...rest,
  })
}

export function confirmDialog(payload: ConfirmOptions) {
  const selector = payload.selector ?? '#t-dialog'
  const { context, host } = resolveDialogContext(selector, payload.context)
  if (!context) {
    return
  }
  const { ...rest } = payload
  if (host && typeof host.setData === 'function') {
    return openConfirmWithHost(host, rest)
  }
  return Dialog.confirm({
    selector,
    context: context as any,
    ...rest,
  })
}

export function useDialog(options: DialogOptions = {}) {
  const context = options.context ?? getCurrentInstance()
  return {
    alert(payload: AlertOptions) {
      return alertDialog({
        ...payload,
        context: payload.context ?? context,
        selector: payload.selector ?? options.selector,
      })
    },
    confirm(payload: ConfirmOptions) {
      return confirmDialog({
        ...payload,
        context: payload.context ?? context,
        selector: payload.selector ?? options.selector,
      })
    },
  }
}
