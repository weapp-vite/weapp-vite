<script setup lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-466',
  usingComponents: {
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
  },
})

const mpContext = getCurrentInstance()
const dialogModule = Dialog as Record<string, any>
const confirmType = typeof dialogModule.confirm
const alertType = typeof dialogModule.alert
const defaultType = typeof dialogModule.default
const defaultConfirmType = typeof dialogModule.default?.confirm

const openCount = ref(0)
const settleCount = ref(0)
const dialogVisible = ref(false)
const lastAction = ref('idle')
const lastError = ref('')
const lastTitle = ref('')
const lastReturnedPromise = ref(false)

let lastDialogPromise: Promise<'confirmed' | 'cancelled'> | null = null

function stringifyError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return String(error)
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
    confirmType,
    alertType,
    defaultType,
    defaultConfirmType,
    openCount: openCount.value,
    settleCount: settleCount.value,
    dialogVisible: dialogVisible.value,
    lastAction: lastAction.value,
    lastError: lastError.value,
    lastTitle: lastTitle.value,
    lastReturnedPromise: lastReturnedPromise.value,
  }
}

function _runE2E() {
  return readRuntimeState()
}

function _resetE2E() {
  openCount.value = 0
  settleCount.value = 0
  dialogVisible.value = false
  lastAction.value = 'idle'
  lastError.value = ''
  lastTitle.value = ''
  lastReturnedPromise.value = false
  lastDialogPromise = null
  return readRuntimeState()
}

async function _openDialogE2E() {
  openCount.value += 1
  lastAction.value = 'opening'
  lastError.value = ''
  lastReturnedPromise.value = false

  try {
    const dialogResult = Dialog.confirm({
      context: mpContext as any,
      selector: '#issue466-dialog',
      title: 'issue-466 confirm title',
      content: 'issue-466 confirm content',
      confirmBtn: '确定',
      cancelBtn: '取消',
    })

    lastReturnedPromise.value = typeof dialogResult?.then === 'function'
    lastDialogPromise = Promise.resolve(dialogResult)
      .then(() => {
        settleCount.value += 1
        lastAction.value = 'confirmed'
        return 'confirmed' as const
      })
      .catch((error) => {
        settleCount.value += 1
        lastAction.value = 'cancelled'
        lastError.value = stringifyError(error)
        return 'cancelled' as const
      })

    await Promise.resolve()
    return readRuntimeState()
  }
  catch (error) {
    lastAction.value = 'threw'
    lastError.value = stringifyError(error)
    return readRuntimeState()
  }
}

async function _confirmDialogE2E() {
  const dialogHost = syncDialogState()

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
  return readRuntimeState()
}
</script>

<template>
  <view class="issue466-page">
    <text class="issue466-title">issue-466 tdesign Dialog.confirm runtime</text>
    <text class="issue466-line">confirmType = {{ confirmType }}</text>
    <text class="issue466-line">defaultConfirmType = {{ defaultConfirmType }}</text>
    <text class="issue466-line">lastAction = {{ lastAction }}</text>
    <text class="issue466-line">lastError = {{ lastError || 'none' }}</text>
    <text class="issue466-line">dialogVisible = {{ dialogVisible }}</text>
    <text class="issue466-line">lastTitle = {{ lastTitle || 'none' }}</text>
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
</style>
