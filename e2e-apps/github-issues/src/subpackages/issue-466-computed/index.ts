import Dialog from 'tdesign-miniprogram/dialog/index'

type DialogMethodName = 'alert' | 'confirm' | 'action' | 'close'

const dialogModule = Dialog as Record<string, any>
const alertType = typeof dialogModule.alert
const confirmType = typeof dialogModule.confirm
const actionType = typeof dialogModule.action
const closeType = typeof dialogModule.close
const defaultType = typeof dialogModule.default
const defaultConfirmType = typeof dialogModule.default?.confirm

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

Page({
  data: {
    a: 1,
    b: 2,
    alertType,
    confirmType,
    actionType,
    closeType,
    defaultConfirmType,
    openCount: 0,
    settleCount: 0,
    alertCount: 0,
    confirmCount: 0,
    actionCount: 0,
    closeCount: 0,
    dialogVisible: false,
    lastMethod: 'idle',
    lastAction: 'idle',
    lastError: '',
    lastPayload: '',
    lastTitle: '',
    lastReturnedPromise: false,
  },

  readProbeState() {
    const probe = this.selectComponent('#issue466-computed-probe') as any
    return probe?._runE2E?.() ?? null
  },

  resolveDialogHost() {
    return this.selectComponent('#issue466-computed-dialog') as any
  },

  syncDialogState() {
    const dialogHost = this.resolveDialogHost()
    this.setData({
      dialogVisible: Boolean(dialogHost?.data?.visible ?? dialogHost?.properties?.visible),
      lastTitle: String(dialogHost?.data?.title ?? dialogHost?.properties?.title ?? ''),
    })
    return dialogHost
  },

  resetLastStatus(method = 'idle') {
    this.setData({
      lastMethod: method,
      lastAction: 'opening',
      lastError: '',
      lastPayload: '',
      lastReturnedPromise: false,
    })
  },

  recordPendingDialog(
    method: DialogMethodName,
    dialogResult: Promise<unknown>,
    successAction: string,
    failureAction: string,
  ) {
    this.setData({
      lastReturnedPromise: typeof dialogResult?.then === 'function',
    })
    lastDialogPromise = Promise.resolve(dialogResult)
      .then((payload) => {
        this.setData({
          settleCount: this.data.settleCount + 1,
          lastMethod: method,
          lastAction: successAction,
          lastPayload: stringifyValue(payload),
        })
        return payload
      })
      .catch((error) => {
        this.setData({
          settleCount: this.data.settleCount + 1,
          lastMethod: method,
          lastAction: failureAction,
          lastError: stringifyValue(error),
          lastPayload: stringifyValue(error),
        })
        return error
      })
      .finally(() => {
        lastDialogPromise = null
      })
  },

  showCloseHost() {
    const dialogHost = this.resolveDialogHost()
    dialogHost?.setData?.({
      actions: [],
      buttonLayout: 'horizontal',
      cancelBtn: '',
      confirmBtn: '仅用于 close 演示',
      content: '先把宿主显示出来，再调用 Dialog.close',
      title: 'issue-466-computed close title',
      visible: true,
    })
    this.syncDialogState()
    return dialogHost
  },

  clearDialogHost() {
    this.resolveDialogHost()?.setData?.({
      actions: [],
      cancelBtn: '',
      confirmBtn: '',
      content: '',
      title: '',
      visible: false,
    })
  },

  _runE2E() {
    this.syncDialogState()
    return {
      pageData: {
        a: this.data.a,
        b: this.data.b,
      },
      probe: this.readProbeState(),
      dialog: {
        alertType,
        confirmType,
        actionType,
        closeType,
        defaultType,
        defaultConfirmType,
        openCount: this.data.openCount,
        settleCount: this.data.settleCount,
        alertCount: this.data.alertCount,
        confirmCount: this.data.confirmCount,
        actionCount: this.data.actionCount,
        closeCount: this.data.closeCount,
        dialogVisible: this.data.dialogVisible,
        lastMethod: this.data.lastMethod,
        lastAction: this.data.lastAction,
        lastError: this.data.lastError,
        lastPayload: this.data.lastPayload,
        lastTitle: this.data.lastTitle,
        lastReturnedPromise: this.data.lastReturnedPromise,
      },
    }
  },

  _resetDialogE2E() {
    lastDialogPromise = null
    this.clearDialogHost()
    this.setData({
      openCount: 0,
      settleCount: 0,
      alertCount: 0,
      confirmCount: 0,
      actionCount: 0,
      closeCount: 0,
      dialogVisible: false,
      lastMethod: 'idle',
      lastAction: 'idle',
      lastError: '',
      lastPayload: '',
      lastTitle: '',
      lastReturnedPromise: false,
    })
    return this._runE2E()
  },

  async _openAlertE2E() {
    this.setData({
      openCount: this.data.openCount + 1,
      alertCount: this.data.alertCount + 1,
    })
    this.resetLastStatus('alert')

    try {
      const dialogResult = Dialog.alert({
        context: this,
        selector: '#issue466-computed-dialog',
        title: 'issue-466-computed alert title',
        content: 'issue-466-computed alert content',
        confirmBtn: '知道了',
      })

      this.recordPendingDialog('alert', dialogResult, 'alert-confirmed', 'alert-failed')
      await Promise.resolve()
      return this._runE2E()
    }
    catch (error) {
      this.setData({
        lastAction: 'alert-threw',
        lastError: stringifyValue(error),
      })
      return this._runE2E()
    }
  },

  async _openConfirmE2E() {
    this.setData({
      openCount: this.data.openCount + 1,
      confirmCount: this.data.confirmCount + 1,
    })
    this.resetLastStatus('confirm')

    try {
      const dialogResult = Dialog.confirm({
        context: this,
        selector: '#issue466-computed-dialog',
        title: 'issue-466-computed confirm title',
        content: 'issue-466-computed confirm content',
        confirmBtn: '确定',
        cancelBtn: '取消',
      })

      this.recordPendingDialog('confirm', dialogResult, 'confirmed', 'cancelled')
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

  async _openActionE2E() {
    this.setData({
      openCount: this.data.openCount + 1,
      actionCount: this.data.actionCount + 1,
    })
    this.resetLastStatus('action')

    try {
      const dialogResult = Dialog.action({
        context: this,
        selector: '#issue466-computed-dialog',
        title: 'issue-466-computed action title',
        content: 'issue-466-computed action content',
        actions: [
          { content: '复制链接', theme: 'default' },
          { content: '删除记录', theme: 'danger' },
        ],
        buttonLayout: 'vertical',
      })

      this.recordPendingDialog('action', dialogResult, 'action-selected', 'action-failed')
      await Promise.resolve()
      return this._runE2E()
    }
    catch (error) {
      this.setData({
        lastAction: 'action-threw',
        lastError: stringifyValue(error),
      })
      return this._runE2E()
    }
  },

  async _prepareCloseHostE2E() {
    this.setData({
      openCount: this.data.openCount + 1,
    })
    this.resetLastStatus('close')
    this.setData({
      lastAction: 'close-prepared',
    })
    const dialogHost = this.showCloseHost()
    if (!dialogHost) {
      this.setData({
        lastAction: 'close-host-missing',
        lastError: 'dialog host missing',
      })
    }
    await Promise.resolve()
    return this._runE2E()
  },

  async _closeDialogE2E() {
    this.setData({
      closeCount: this.data.closeCount + 1,
      lastMethod: 'close',
      lastAction: 'closing',
      lastError: '',
      lastPayload: '',
      lastReturnedPromise: false,
    })

    try {
      const closeResult = Dialog.close({
        context: this,
        selector: '#issue466-computed-dialog',
      })

      this.setData({
        lastReturnedPromise: typeof closeResult?.then === 'function',
      })
      await closeResult
      this.setData({
        settleCount: this.data.settleCount + 1,
        lastAction: 'closed',
      })
      await Promise.resolve()
      return this._runE2E()
    }
    catch (error) {
      this.setData({
        lastAction: 'close-threw',
        lastError: stringifyValue(error),
      })
      return this._runE2E()
    }
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

  async _selectSecondActionE2E() {
    const dialogHost = this.syncDialogState()

    if (typeof dialogHost?.onActionTap === 'function') {
      dialogHost.onActionTap(1)
    }
    else if (typeof dialogHost?._onAction === 'function') {
      dialogHost._onAction({ index: 1 })
    }

    if (lastDialogPromise) {
      await lastDialogPromise
    }

    await Promise.resolve()
    return this._runE2E()
  },

  applyNextE2E() {
    this.setData({
      a: 3,
      b: 4,
    })
    return this._runE2E()
  },
})
