import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance } from 'wevu'

export interface DialogOptions {
  context?: any
  selector?: string
}

export interface AlertOptions {
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title?: string
}

export interface ConfirmOptions {
  cancelBtn?: string
  confirmBtn?: string
  content: string
  context?: any
  selector?: string
  title?: string
}

function resolveDialogContext(context?: any) {
  return context ?? getCurrentInstance()
}

export function alertDialog(payload: AlertOptions) {
  const context = resolveDialogContext(payload.context)
  if (!context) {
    return
  }
  const { selector = '#t-dialog', ...rest } = payload
  return Dialog.alert({
    selector,
    context: context as any,
    ...rest,
  })
}

export function confirmDialog(payload: ConfirmOptions) {
  const context = resolveDialogContext(payload.context)
  if (!context) {
    return
  }
  const { selector = '#t-dialog', ...rest } = payload
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
