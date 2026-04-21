import Dialog from 'tdesign-miniprogram/dialog'
import Toast from 'tdesign-miniprogram/toast'

type Trigger = 'idle' | 'user-tap' | 'e2e'

const dialogModule = Dialog as Record<string, any>
const toastModule = Toast as Record<string, any>
let lastDialogPromise: Promise<unknown> | null = null

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.message || String(value)
  }
  if (value == null) {
    return ''
  }
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

function readDialogTypes() {
  return {
    confirmType: typeof dialogModule.confirm,
    defaultType: typeof dialogModule.default,
    defaultConfirmType: typeof dialogModule.default?.confirm,
  }
}

function readToastTypes() {
  return {
    toastType: typeof Toast,
    toastDefaultType: typeof toastModule.default,
  }
}

Page({
  data: {
    importMode: 'bare',
    ...readDialogTypes(),
    ...readToastTypes(),
    openCount: 0,
    settleCount: 0,
    dialogVisible: false,
    lastAction: 'idle',
    lastTrigger: 'idle' as Trigger,
    lastError: '',
    lastPayload: '',
    lastTitle: '',
    lastReturnedPromise: false,
    toastCount: 0,
    lastToastAction: 'idle',
    lastToastTrigger: 'idle' as Trigger,
    lastToastError: '',
    lastToastMessage: '',
  },
  resolveDialogHost() {
    return this.selectComponent('#t-dialog') as Record<string, any> | null
  },
  syncDialogState() {
    const dialogHost = this.resolveDialogHost()
    const nextVisible = Boolean(dialogHost?.data?.visible ?? dialogHost?.properties?.visible)
    const nextTitle = String(dialogHost?.data?.title ?? dialogHost?.properties?.title ?? '')
    if (nextVisible !== this.data.dialogVisible || nextTitle !== this.data.lastTitle) {
      this.setData({
        dialogVisible: nextVisible,
        lastTitle: nextTitle,
      })
    }
    return dialogHost
  },
  readRuntimeState() {
    this.syncDialogState()
    return {
      importMode: this.data.importMode,
      confirmType: this.data.confirmType,
      defaultType: this.data.defaultType,
      defaultConfirmType: this.data.defaultConfirmType,
      openCount: this.data.openCount,
      settleCount: this.data.settleCount,
      dialogVisible: this.data.dialogVisible,
      lastAction: this.data.lastAction,
      lastTrigger: this.data.lastTrigger,
      lastError: this.data.lastError,
      lastPayload: this.data.lastPayload,
      lastTitle: this.data.lastTitle,
      lastReturnedPromise: this.data.lastReturnedPromise,
      toastType: this.data.toastType,
      toastDefaultType: this.data.toastDefaultType,
      toastCount: this.data.toastCount,
      lastToastAction: this.data.lastToastAction,
      lastToastTrigger: this.data.lastToastTrigger,
      lastToastError: this.data.lastToastError,
      lastToastMessage: this.data.lastToastMessage,
    }
  },
  resetLastStatus(trigger: Trigger) {
    this.setData({
      lastAction: 'opening',
      lastTrigger: trigger,
      lastError: '',
      lastPayload: '',
      lastReturnedPromise: false,
    })
  },
  trackDialogPromise(dialogResult: Promise<unknown>) {
    this.setData({
      lastReturnedPromise: typeof dialogResult?.then === 'function',
    })

    lastDialogPromise = Promise.resolve(dialogResult)
      .then((payload) => {
        this.setData({
          settleCount: this.data.settleCount + 1,
          lastAction: 'confirmed',
          lastPayload: stringifyValue(payload),
        })
        return payload
      })
      .catch((error) => {
        const serialized = stringifyValue(error)
        this.setData({
          settleCount: this.data.settleCount + 1,
          lastAction: 'cancelled',
          lastError: serialized,
          lastPayload: serialized,
        })
        return error
      })
      .finally(() => {
        lastDialogPromise = null
      })
  },
  async openConfirmDialog(trigger: Trigger) {
    this.setData({
      openCount: this.data.openCount + 1,
    })
    this.resetLastStatus(trigger)

    try {
      const dialogResult = Dialog.confirm({
        context: this,
        selector: '#t-dialog',
        title: 'issue-dialog-bare confirm title',
        content: 'issue-dialog-bare confirm content',
        confirmBtn: '确定',
        cancelBtn: '取消',
      })

      this.trackDialogPromise(dialogResult)
      await Promise.resolve()
      return this._runE2E()
    }
    catch (error) {
      this.setData({
        lastAction: 'confirm-threw',
        lastError: stringifyValue(error),
      })
      return this._runE2E()
    }
  },
  onOpenDialog() {
    void this.openConfirmDialog('user-tap')
  },
  async showToast(trigger: Trigger) {
    const message = `issue-dialog-bare toast ${trigger}`

    try {
      Toast({
        context: this,
        selector: '#t-toast',
        message,
        theme: 'success',
        direction: 'column',
      })

      this.setData({
        toastCount: this.data.toastCount + 1,
        lastToastAction: 'shown',
        lastToastTrigger: trigger,
        lastToastError: '',
        lastToastMessage: message,
      })
    }
    catch (error) {
      this.setData({
        lastToastAction: 'toast-threw',
        lastToastTrigger: trigger,
        lastToastError: stringifyValue(error),
        lastToastMessage: message,
      })
    }

    await Promise.resolve()
    return this._runE2E()
  },
  onOpenToast() {
    void this.showToast('user-tap')
  },
  _runE2E() {
    return this.readRuntimeState()
  },
  _resetE2E() {
    lastDialogPromise = null
    this.resolveDialogHost()?.setData?.({
      cancelBtn: '',
      confirmBtn: '',
      content: '',
      title: '',
      visible: false,
    })
    this.setData({
      ...readDialogTypes(),
      ...readToastTypes(),
      openCount: 0,
      settleCount: 0,
      dialogVisible: false,
      lastAction: 'idle',
      lastTrigger: 'idle',
      lastError: '',
      lastPayload: '',
      lastTitle: '',
      lastReturnedPromise: false,
      toastCount: 0,
      lastToastAction: 'idle',
      lastToastTrigger: 'idle',
      lastToastError: '',
      lastToastMessage: '',
    })
    return this._runE2E()
  },
  async _openDialogE2E() {
    return await this.openConfirmDialog('e2e')
  },
  async _confirmDialogE2E() {
    const dialogHost = this.syncDialogState()
    if (typeof dialogHost?.onConfirm === 'function') {
      dialogHost.onConfirm()
    }
    else if (typeof dialogHost?._onConfirm === 'function') {
      dialogHost._onConfirm({ trigger: 'confirm' })
    }

    if (lastDialogPromise) {
      await lastDialogPromise
    }

    await Promise.resolve()
    return this._runE2E()
  },
  async _cancelDialogE2E() {
    const dialogHost = this.syncDialogState()
    if (typeof dialogHost?.onCancel === 'function') {
      dialogHost.onCancel()
    }
    else if (typeof dialogHost?._onCancel === 'function') {
      dialogHost._onCancel({ trigger: 'cancel' })
    }

    if (lastDialogPromise) {
      await lastDialogPromise
    }

    await Promise.resolve()
    return this._runE2E()
  },
  async _openToastE2E() {
    return await this.showToast('e2e')
  },
})
