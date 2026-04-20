<script setup lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-466',
  usingComponents: {
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
  },
})

type DialogMethodName = 'alert' | 'confirm' | 'action' | 'close'

const mpContext = getCurrentInstance()
const dialogModule = Dialog as Record<string, any>
const alertType = typeof dialogModule.alert
const confirmType = typeof dialogModule.confirm
const actionType = typeof dialogModule.action
const closeType = typeof dialogModule.close
const defaultType = typeof dialogModule.default
const defaultConfirmType = typeof dialogModule.default?.confirm

const openCount = ref(0)
const settleCount = ref(0)
const alertCount = ref(0)
const confirmCount = ref(0)
const actionCount = ref(0)
const closeCount = ref(0)
const dialogVisible = ref(false)
const lastMethod = ref('idle')
const lastAction = ref('idle')
const lastError = ref('')
const lastPayload = ref('')
const lastTitle = ref('')
const lastReturnedPromise = ref(false)

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

function resolveDialogHost() {
  return (mpContext as any)?.selectComponent?.('#issue466-dialog') ?? null
}

function syncDialogState() {
  const dialogHost = resolveDialogHost()
  dialogVisible.value = Boolean(dialogHost?.data?.visible ?? dialogHost?.properties?.visible)
  lastTitle.value = String(dialogHost?.data?.title ?? dialogHost?.properties?.title ?? '')
  return dialogHost
}

function readRuntimeState() {
  syncDialogState()
  return {
    alertType,
    confirmType,
    actionType,
    closeType,
    defaultType,
    defaultConfirmType,
    openCount: openCount.value,
    settleCount: settleCount.value,
    alertCount: alertCount.value,
    confirmCount: confirmCount.value,
    actionCount: actionCount.value,
    closeCount: closeCount.value,
    dialogVisible: dialogVisible.value,
    lastMethod: lastMethod.value,
    lastAction: lastAction.value,
    lastError: lastError.value,
    lastPayload: lastPayload.value,
    lastTitle: lastTitle.value,
    lastReturnedPromise: lastReturnedPromise.value,
  }
}

function resetLastStatus(method = 'idle') {
  lastMethod.value = method
  lastAction.value = 'opening'
  lastError.value = ''
  lastPayload.value = ''
  lastReturnedPromise.value = false
}

function trackDialogPromise(
  method: DialogMethodName,
  dialogResult: Promise<unknown>,
  successAction: string,
  failureAction: string,
) {
  lastReturnedPromise.value = typeof dialogResult?.then === 'function'
  lastDialogPromise = Promise.resolve(dialogResult)
    .then((payload) => {
      settleCount.value += 1
      lastMethod.value = method
      lastAction.value = successAction
      lastPayload.value = stringifyValue(payload)
      return payload
    })
    .catch((error) => {
      settleCount.value += 1
      lastMethod.value = method
      lastAction.value = failureAction
      lastError.value = stringifyValue(error)
      lastPayload.value = stringifyValue(error)
      return error
    })
    .finally(() => {
      lastDialogPromise = null
    })
}

function showCloseHost() {
  const dialogHost = resolveDialogHost()
  dialogHost?.setData?.({
    actions: [],
    buttonLayout: 'horizontal',
    cancelBtn: '',
    confirmBtn: '仅用于 close 演示',
    content: '先把宿主显示出来，再调用 Dialog.close',
    title: 'issue-466 close title',
    visible: true,
  })
  syncDialogState()
  return dialogHost
}

function clearDialogHost() {
  resolveDialogHost()?.setData?.({
    actions: [],
    cancelBtn: '',
    confirmBtn: '',
    content: '',
    title: '',
    visible: false,
  })
}

function _runE2E() {
  return readRuntimeState()
}

function _resetE2E() {
  openCount.value = 0
  settleCount.value = 0
  alertCount.value = 0
  confirmCount.value = 0
  actionCount.value = 0
  closeCount.value = 0
  dialogVisible.value = false
  lastMethod.value = 'idle'
  lastAction.value = 'idle'
  lastError.value = ''
  lastPayload.value = ''
  lastTitle.value = ''
  lastReturnedPromise.value = false
  lastDialogPromise = null
  clearDialogHost()
  return readRuntimeState()
}

async function _openAlertE2E() {
  openCount.value += 1
  alertCount.value += 1
  resetLastStatus('alert')

  try {
    const dialogResult = Dialog.alert({
      context: mpContext as any,
      selector: '#issue466-dialog',
      title: 'issue-466 alert title',
      content: 'issue-466 alert content',
      confirmBtn: '知道了',
    })

    trackDialogPromise('alert', dialogResult, 'alert-confirmed', 'alert-failed')
    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'alert-threw'
    lastError.value = stringifyValue(error)
    return readRuntimeState()
  }
}

async function _openConfirmE2E() {
  openCount.value += 1
  confirmCount.value += 1
  resetLastStatus('confirm')

  try {
    const dialogResult = Dialog.confirm({
      context: mpContext as any,
      selector: '#issue466-dialog',
      title: 'issue-466 confirm title',
      content: 'issue-466 confirm content',
      confirmBtn: '确定',
      cancelBtn: '取消',
    })

    trackDialogPromise('confirm', dialogResult, 'confirmed', 'cancelled')
    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'confirm-threw'
    lastError.value = stringifyValue(error)
    return readRuntimeState()
  }
}

async function _openActionE2E() {
  openCount.value += 1
  actionCount.value += 1
  resetLastStatus('action')

  try {
    const dialogResult = Dialog.action({
      context: mpContext as any,
      selector: '#issue466-dialog',
      title: 'issue-466 action title',
      content: 'issue-466 action content',
      actions: [
        { content: '复制链接', theme: 'default' },
        { content: '删除记录', theme: 'danger' },
      ],
      buttonLayout: 'vertical',
    })

    trackDialogPromise('action', dialogResult, 'action-selected', 'action-failed')
    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'action-threw'
    lastError.value = stringifyValue(error)
    return readRuntimeState()
  }
}

async function _prepareCloseHostE2E() {
  openCount.value += 1
  resetLastStatus('close')
  lastAction.value = 'close-prepared'
  const dialogHost = showCloseHost()
  if (!dialogHost) {
    lastAction.value = 'close-host-missing'
    lastError.value = 'dialog host missing'
  }
  await Promise.resolve()
  return readRuntimeState()
}

async function _closeDialogE2E() {
  closeCount.value += 1
  lastMethod.value = 'close'
  lastAction.value = 'closing'
  lastError.value = ''
  lastPayload.value = ''
  lastReturnedPromise.value = false

  try {
    const closeResult = Dialog.close({
      context: mpContext as any,
      selector: '#issue466-dialog',
    })

    lastReturnedPromise.value = typeof closeResult?.then === 'function'
    await closeResult
    settleCount.value += 1
    lastAction.value = 'closed'
    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'close-threw'
    lastError.value = stringifyValue(error)
    return readRuntimeState()
  }
}

async function _confirmDialogE2E() {
  const dialogHost = syncDialogState()

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
  return readRuntimeState()
}

async function _cancelDialogE2E() {
  const dialogHost = syncDialogState()

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
  return readRuntimeState()
}

async function _selectSecondActionE2E() {
  const dialogHost = syncDialogState()

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
  return readRuntimeState()
}

async function _openDialogE2E() {
  return await _openConfirmE2E()
}
</script>

<template>
  <view class="issue466-page">
    <text class="issue466-title">issue-466 tdesign Dialog.confirm runtime + all methods</text>
    <text class="issue466-line">alertType = {{ alertType }}</text>
    <text class="issue466-line">confirmType = {{ confirmType }}</text>
    <text class="issue466-line">actionType = {{ actionType }}</text>
    <text class="issue466-line">closeType = {{ closeType }}</text>
    <text class="issue466-line">defaultConfirmType = {{ defaultConfirmType }}</text>
    <text class="issue466-line">lastMethod = {{ lastMethod }}</text>
    <text class="issue466-line">lastAction = {{ lastAction }}</text>
    <text class="issue466-line">lastPayload = {{ lastPayload || 'none' }}</text>
    <text class="issue466-line">lastError = {{ lastError || 'none' }}</text>
    <text class="issue466-line">dialogVisible = {{ dialogVisible }}</text>
    <text class="issue466-line">lastTitle = {{ lastTitle || 'none' }}</text>
    <text class="issue466-line">counts = open {{ openCount }}, settle {{ settleCount }}</text>
    <text class="issue466-line">methodCounts = alert {{ alertCount }}, confirm {{ confirmCount }}, action {{ actionCount }}, close {{ closeCount }}</text>
    <view class="issue466-actions">
      <button class="issue466-button" @tap="_openAlertE2E">
        打开 alert
      </button>
      <button class="issue466-button" @tap="_openConfirmE2E">
        打开 confirm
      </button>
      <button class="issue466-button" @tap="_openActionE2E">
        打开 action
      </button>
      <button class="issue466-button" @tap="_confirmDialogE2E">
        触发 confirm
      </button>
      <button class="issue466-button" @tap="_cancelDialogE2E">
        触发 cancel
      </button>
      <button class="issue466-button" @tap="_selectSecondActionE2E">
        选择 action[1]
      </button>
      <button class="issue466-button" @tap="_prepareCloseHostE2E">
        准备 close 宿主
      </button>
      <button class="issue466-button" @tap="_closeDialogE2E">
        调用 Dialog.close
      </button>
      <button class="issue466-button issue466-button--reset" @tap="_resetE2E">
        重置状态
      </button>
    </view>
    <t-dialog id="issue466-dialog" />
  </view>
</template>

<style scoped>
.issue466-page {
  padding: 32rpx;
}

.issue466-title,
.issue466-line {
  display: block;
  margin-bottom: 24rpx;
}

.issue466-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin: 32rpx 0;
}

.issue466-button {
  width: calc(50% - 8rpx);
}

.issue466-button--reset {
  width: 100%;
}
</style>
