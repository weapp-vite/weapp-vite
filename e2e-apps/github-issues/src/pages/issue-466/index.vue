<script setup lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-466-main',
  usingComponents: {
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
  },
})

type DialogOutcome = 'confirmed' | 'cancelled'
type OpenTrigger = 'idle' | 'user-tap' | 'e2e'

const mpContext = getCurrentInstance()
const dialogModule = Dialog as Record<string, any>
const confirmType = typeof dialogModule.confirm
const defaultType = typeof dialogModule.default
const defaultConfirmType = typeof dialogModule.default?.confirm

const openCount = ref(0)
const settleCount = ref(0)
const dialogVisible = ref(false)
const lastAction = ref('idle')
const lastTrigger = ref<OpenTrigger>('idle')
const lastError = ref('')
const lastPayload = ref('')
const lastTitle = ref('')
const lastReturnedPromise = ref(false)

let lastDialogPromise: Promise<DialogOutcome> | null = null

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
  return (mpContext as any)?.selectComponent?.('#issue466-main-dialog') ?? null
}

function syncDialogState() {
  const dialogHost = resolveDialogHost()
  dialogVisible.value = Boolean(dialogHost?.data?.visible ?? dialogHost?.properties?.visible)
  lastTitle.value = String(dialogHost?.data?.title ?? dialogHost?.properties?.title ?? '')
  return dialogHost
}

function clearDialogHost() {
  resolveDialogHost()?.setData?.({
    cancelBtn: '',
    confirmBtn: '',
    content: '',
    title: '',
    visible: false,
  })
}

function readRuntimeState() {
  syncDialogState()
  return {
    confirmType,
    defaultType,
    defaultConfirmType,
    openCount: openCount.value,
    settleCount: settleCount.value,
    dialogVisible: dialogVisible.value,
    lastAction: lastAction.value,
    lastTrigger: lastTrigger.value,
    lastError: lastError.value,
    lastPayload: lastPayload.value,
    lastTitle: lastTitle.value,
    lastReturnedPromise: lastReturnedPromise.value,
  }
}

function resetLastStatus(trigger: OpenTrigger) {
  lastAction.value = 'opening'
  lastTrigger.value = trigger
  lastError.value = ''
  lastPayload.value = ''
  lastReturnedPromise.value = false
}

function trackDialogPromise(dialogResult: Promise<unknown>) {
  lastReturnedPromise.value = typeof dialogResult?.then === 'function'
  lastDialogPromise = Promise.resolve(dialogResult)
    .then((payload) => {
      settleCount.value += 1
      lastAction.value = 'confirmed'
      lastPayload.value = stringifyValue(payload)
      return 'confirmed' as const
    })
    .catch((error) => {
      settleCount.value += 1
      lastAction.value = 'cancelled'
      lastError.value = stringifyValue(error)
      lastPayload.value = stringifyValue(error)
      return 'cancelled' as const
    })
    .finally(() => {
      lastDialogPromise = null
    })
}

async function openConfirmDialog(trigger: OpenTrigger) {
  openCount.value += 1
  resetLastStatus(trigger)

  try {
    const dialogResult = Dialog.confirm({
      context: mpContext as any,
      selector: '#issue466-main-dialog',
      title: 'issue-466 main confirm title',
      content: 'issue-466 main confirm content',
      confirmBtn: '确定',
      cancelBtn: '取消',
    })

    trackDialogPromise(dialogResult)
    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'confirm-threw'
    lastError.value = stringifyValue(error)
    return readRuntimeState()
  }
}

function handleOpenConfirmTap() {
  void openConfirmDialog('user-tap')
}

function _runE2E() {
  return readRuntimeState()
}

function _resetE2E() {
  openCount.value = 0
  settleCount.value = 0
  dialogVisible.value = false
  lastAction.value = 'idle'
  lastTrigger.value = 'idle'
  lastError.value = ''
  lastPayload.value = ''
  lastTitle.value = ''
  lastReturnedPromise.value = false
  lastDialogPromise = null
  clearDialogHost()
  return readRuntimeState()
}

async function _openDialogE2E() {
  return await openConfirmDialog('e2e')
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
</script>

<template>
  <view class="issue466-main-page">
    <text class="issue466-main-title">
      issue-466 main-package tdesign Dialog.confirm
    </text>
    <text class="issue466-main-line">confirmType = {{ confirmType }}</text>
    <text class="issue466-main-line">defaultConfirmType = {{ defaultConfirmType }}</text>
    <text class="issue466-main-line">lastAction = {{ lastAction }}</text>
    <text class="issue466-main-line">lastTrigger = {{ lastTrigger }}</text>
    <text class="issue466-main-line">lastPayload = {{ lastPayload || 'none' }}</text>
    <text class="issue466-main-line">lastError = {{ lastError || 'none' }}</text>
    <text class="issue466-main-line">dialogVisible = {{ dialogVisible }}</text>
    <text class="issue466-main-line">lastTitle = {{ lastTitle || 'none' }}</text>
    <text class="issue466-main-line">counts = open {{ openCount }}, settle {{ settleCount }}</text>
    <button id="issue466-main-open" class="issue466-main-button" @tap="handleOpenConfirmTap">
      打开 confirm
    </button>
    <button class="issue466-main-button issue466-main-button--secondary" @tap="_resetE2E">
      重置状态
    </button>
    <t-dialog id="issue466-main-dialog" />
  </view>
</template>

<style scoped>
.issue466-main-page {
  padding: 32rpx;
}

.issue466-main-title,
.issue466-main-line {
  display: block;
  margin-bottom: 24rpx;
}

.issue466-main-button {
  margin-bottom: 16rpx;
}

.issue466-main-button--secondary {
  color: #475569;
  background: #e2e8f0;
}
</style>
