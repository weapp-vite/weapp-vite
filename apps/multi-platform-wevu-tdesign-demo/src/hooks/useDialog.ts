import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance } from 'wevu'

export interface DialogOptions {
  selector?: string
}

export interface AlertOptions {
  title: string
  content: string
  confirmBtn?: string
}

export function useDialog(options: DialogOptions = {}) {
  const mpContext = getCurrentInstance()
  const selector = options.selector ?? '#t-dialog'

  function alert(payload: AlertOptions) {
    if (!mpContext) {
      return
    }
    Dialog.alert({
      selector,
      context: mpContext as any,
      ...payload,
    })
  }

  return {
    alert,
  }
}
