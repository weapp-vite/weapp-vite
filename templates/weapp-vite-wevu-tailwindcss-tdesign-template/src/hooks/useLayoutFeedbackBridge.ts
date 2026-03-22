import type { TemplateRef } from 'wevu'
import { useLayoutBridge } from 'wevu'

export const LAYOUT_TOAST_BRIDGE_KEY = 'layout-toast'
export const LAYOUT_DIALOG_BRIDGE_KEY = 'layout-dialog'

export interface ToastHostInstance {
  hide?: () => void
  show: (options: Record<string, unknown>) => void
}

export interface DialogHostInstance {
  _onCancel?: (reason?: unknown) => void
  _onConfirm?: (value?: unknown) => void
  close?: () => void
  properties?: Record<string, unknown>
  setData: (payload: Record<string, unknown>) => void
}

export function useLayoutFeedbackBridge(hosts: {
  dialog: TemplateRef<DialogHostInstance>
  toast: TemplateRef<ToastHostInstance>
}) {
  useLayoutBridge([LAYOUT_TOAST_BRIDGE_KEY, LAYOUT_DIALOG_BRIDGE_KEY], {
    resolveComponent(key) {
      if (key === LAYOUT_TOAST_BRIDGE_KEY) {
        return hosts.toast.value
      }
      if (key === LAYOUT_DIALOG_BRIDGE_KEY) {
        return hosts.dialog.value
      }
      return null
    },
  })
}
