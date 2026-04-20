import Dialog from 'tdesign-miniprogram/dialog/index'

type DialogOutcome = 'confirmed' | 'cancelled'

const dialogModule = Dialog as Record<string, any>
const confirmType = typeof dialogModule.confirm
const alertType = typeof dialogModule.alert
const defaultType = typeof dialogModule.default
const defaultConfirmType = typeof dialogModule.default?.confirm

let lastDialogPromise: Promise<DialogOutcome> | null = null

function stringifyError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return String(error)
}

Page({
  data: {
    confirmType,
    alertType,
    defaultType,
    defaultConfirmType,
    openCount: 0,
    settleCount: 0,
    dialogVisible: false,
    lastAction: 'idle',
    lastError: '',
    lastTitle: '',
    lastReturnedPromise: false,
  },

  resolveDialogHost() {
    return this.selectComponent?.('#issue466-native-dialog') as any
  },

  syncDialogState() {
    const dialogHost = this.resolveDialogHost()
    const nextState = {
      dialogVisible: Boolean(dialogHost?.data?.visible ?? dialogHost?.properties?.visible),
      lastTitle: String(dialogHost?.data?.title ?? dialogHost?.properties?.title ?? ''),
    }
    this.setData(nextState)
    return dialogHost
  },

  readRuntimeState() {
    this.syncDialogState()
    return {
      confirmType: this.data.confirmType,
      alertType: this.data.alertType,
      defaultType: this.data.defaultType,
      defaultConfirmType: this.data.defaultConfirmType,
      openCount: this.data.openCount,
      settleCount: this.data.settleCount,
      dialogVisible: this.data.dialogVisible,
      lastAction: this.data.lastAction,
      lastError: this.data.lastError,
      lastTitle: this.data.lastTitle,
      lastReturnedPromise: this.data.lastReturnedPromise,
    }
  },

  _runE2E() {
    return this.readRuntimeState()
  },

  _resetE2E() {
    this.setData({
      openCount: 0,
      settleCount: 0,
      dialogVisible: false,
      lastAction: 'idle',
      lastError: '',
      lastTitle: '',
      lastReturnedPromise: false,
    })
    lastDialogPromise = null
    return this.readRuntimeState()
  },

  async _openDialogE2E() {
    this.setData({
      openCount: this.data.openCount + 1,
      lastAction: 'opening',
      lastError: '',
      lastReturnedPromise: false,
    })

    try {
      const dialogResult = Dialog.confirm({
        context: this,
        selector: '#issue466-native-dialog',
        title: 'issue-466 native confirm title',
        content: 'issue-466 native confirm content',
        confirmBtn: '确定',
        cancelBtn: '取消',
      })

      this.setData({
        lastReturnedPromise: typeof dialogResult?.then === 'function',
      })

      lastDialogPromise = Promise.resolve(dialogResult)
        .then(() => {
          this.setData({
            settleCount: this.data.settleCount + 1,
            lastAction: 'confirmed',
          })
          return 'confirmed' as const
        })
        .catch((error) => {
          this.setData({
            settleCount: this.data.settleCount + 1,
            lastAction: 'cancelled',
            lastError: stringifyError(error),
          })
          return 'cancelled' as const
        })

      await Promise.resolve()
      return this.readRuntimeState()
    }
    catch (error) {
      this.setData({
        lastAction: 'threw',
        lastError: stringifyError(error),
      })
      return this.readRuntimeState()
    }
  },

  async _confirmDialogE2E() {
    const dialogHost = this.syncDialogState()

    if (typeof dialogHost?.onConfirm === 'function') {
      dialogHost.onConfirm()
    }
    else if (typeof dialogHost?._onConfirm === 'function') {
      dialogHost._onConfirm()
    }

    if (lastDialogPromise) {
      await lastDialogPromise
    }

    await Promise.resolve()
    return this.readRuntimeState()
  },
})
