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
  onCancel?: (reason?: unknown) => void
  onConfirm?: (value?: unknown) => void
  properties?: Record<string, unknown>
  setData: (payload: Record<string, unknown>) => void
}
