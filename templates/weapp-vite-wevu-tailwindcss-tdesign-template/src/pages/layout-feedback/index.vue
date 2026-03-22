<script setup lang="ts">
import { computed, getCurrentInstance, ref, resolveLayoutHost } from 'wevu'
import SectionTitle from '@/components/SectionTitle/index.vue'
import { useDialog } from '@/hooks/useDialog'
import { LAYOUT_DIALOG_BRIDGE_KEY, LAYOUT_TOAST_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'
import { useToast } from '@/hooks/useToast'
import FeedbackCallerCard from './components/FeedbackCallerCard.vue'

definePageJson({
  navigationBarTitleText: 'Layout 通信演示',
  backgroundColor: '#f6f7fb',
})

const pageInstance = getCurrentInstance<any>()
const { showToast } = useToast({ duration: 1400 })
const { alert, confirm } = useDialog()
const actionSeed = ref(0)
const actionLogs = ref<string[]>([
  '页面与子组件都会直接调用 useToast() / useDialog()，由 layout 统一承载宿主。',
])

const bridgeStatus = computed(() => {
  const toastHost = resolveLayoutHost(LAYOUT_TOAST_BRIDGE_KEY, { context: pageInstance })
  const dialogHost = resolveLayoutHost(LAYOUT_DIALOG_BRIDGE_KEY, { context: pageInstance })

  return [
    {
      key: 'toast',
      title: 'Toast Host',
      description: toastHost ? '已解析到 layout 内的 t-toast 实例。' : '尚未解析到 toast 宿主。',
      ready: Boolean(toastHost),
    },
    {
      key: 'dialog',
      title: 'Dialog Host',
      description: dialogHost ? '已解析到 layout 内的 t-dialog 实例。' : '尚未解析到 dialog 宿主。',
      ready: Boolean(dialogHost),
    },
  ]
})

function pushLog(message: string) {
  actionLogs.value = [`${new Date().toLocaleTimeString()} ${message}`, ...actionLogs.value].slice(0, 8)
}

function onChildReport(message: string) {
  pushLog(message)
}

function nextLabel(prefix: string) {
  actionSeed.value += 1
  return `${prefix} #${actionSeed.value}`
}

function triggerPageToast() {
  const label = nextLabel('页面 Toast')
  showToast(`${label} 已通过 layout 宿主触发`)
  pushLog(`${label} 已触发`)
}

function triggerPageAlert() {
  const label = nextLabel('页面 Alert')
  void alert({
    title: label,
    content: '这是页面直接调用 useDialog() 后，由 layout 内 t-dialog 承载的弹窗。',
    confirmBtn: '知道了',
  }).then(() => {
    pushLog(`${label} 已确认`)
  })
}

function triggerPageConfirm() {
  const label = nextLabel('页面 Confirm')
  void confirm({
    title: label,
    content: '确认后会写入日志，方便观察页面与 layout 宿主之间的通信。',
    confirmBtn: '确认',
    cancelBtn: '取消',
  }).then(() => {
    pushLog(`${label} 点击确认`)
  }).catch(() => {
    pushLog(`${label} 点击取消`)
  })
}

function inspectDialogHostE2E() {
  const dialogHost = resolveLayoutHost<any>(LAYOUT_DIALOG_BRIDGE_KEY, { context: pageInstance })
  return {
    hasHost: Boolean(dialogHost),
    visible: dialogHost?.data?.visible ?? dialogHost?.properties?.visible ?? null,
    hasOnConfirm: typeof dialogHost?._onConfirm === 'function',
    hasOnCancel: typeof dialogHost?._onCancel === 'function',
    hasNativeConfirm: typeof dialogHost?.onConfirm === 'function',
    hasNativeCancel: typeof dialogHost?.onCancel === 'function',
    title: dialogHost?.data?.title ?? dialogHost?.properties?.title ?? '',
    confirmBtn: dialogHost?.data?._confirm?.content ?? dialogHost?.properties?.confirmBtn ?? '',
    cancelBtn: dialogHost?.data?._cancel?.content ?? dialogHost?.properties?.cancelBtn ?? '',
  }
}

async function runPageAlertCloseE2E() {
  triggerPageAlert()
  await new Promise(resolve => setTimeout(resolve, 120))
  return inspectDialogHostE2E()
}

async function runPageConfirmOpenE2E() {
  triggerPageConfirm()
  await new Promise(resolve => setTimeout(resolve, 120))
  return inspectDialogHostE2E()
}

function getLayoutFeedbackLogsE2E() {
  return actionLogs.value.slice()
}

async function runDialogHostConfirmE2E() {
  const dialogHost = resolveLayoutHost<any>(LAYOUT_DIALOG_BRIDGE_KEY, { context: pageInstance })
  dialogHost?.onConfirm?.()
  await new Promise(resolve => setTimeout(resolve, 60))
  return inspectDialogHostE2E()
}

async function runDialogHostCancelE2E() {
  const dialogHost = resolveLayoutHost<any>(LAYOUT_DIALOG_BRIDGE_KEY, { context: pageInstance })
  dialogHost?.onCancel?.()
  await new Promise(resolve => setTimeout(resolve, 60))
  return inspectDialogHostE2E()
}

void inspectDialogHostE2E
void runPageAlertCloseE2E
void runPageConfirmOpenE2E
void getLayoutFeedbackLogsE2E
void runDialogHostConfirmE2E
void runDialogHostCancelE2E
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#eef2ff] via-[#ffffff] to-[#ede9fe] p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.06)]">
      <SectionTitle title="Layout 反馈宿主通信" subtitle="页面与子组件都直接调用 hooks，由 layout 持有 toast / dialog 组件实例" />
      <text class="mt-[12rpx] block text-[22rpx] leading-[1.7] text-[#5b5b7b]">
        推荐用法是业务侧只关心 useToast() / useDialog()，layout 负责注册宿主；页面和组件都不需要关心 id、selector，也不需要直接拿 layout 实例。
      </text>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="Bridge 状态" subtitle="当前页面是否成功解析到 layout 宿主" />
      <view class="mt-[16rpx] flex flex-col gap-[12rpx]">
        <view
          v-for="item in bridgeStatus"
          :key="item.key"
          class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]"
        >
          <view class="flex items-center justify-between">
            <text class="text-[24rpx] font-semibold text-[#1f1a3f]">
              {{ item.title }}
            </text>
            <t-tag :theme="item.ready ? 'success' : 'warning'" size="small" variant="light">
              {{ item.ready ? 'Ready' : 'Pending' }}
            </t-tag>
          </view>
          <text class="mt-[8rpx] block text-[20rpx] leading-[1.7] text-[#6f6b8a]">
            {{ item.description }}
          </text>
        </view>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="页面直接调用" subtitle="页面本身直接触发 layout 内的 toast / dialog 方法" />
      <view class="mt-[16rpx] flex flex-col gap-[12rpx]">
        <t-button block theme="primary" @tap="triggerPageToast">
          页面触发 Toast
        </t-button>
        <t-button block theme="primary" variant="outline" @tap="triggerPageAlert">
          页面触发 Alert
        </t-button>
        <t-button block theme="danger" variant="outline" @tap="triggerPageConfirm">
          页面触发 Confirm
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx]">
      <FeedbackCallerCard :on-report="onChildReport" />
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="通信日志" subtitle="观察页面与子组件调用 layout 宿主后的反馈结果" />
      <view class="mt-[16rpx] flex flex-col gap-[10rpx]">
        <view
          v-for="(item, index) in actionLogs"
          :key="`${item}-${index}`"
          class="rounded-[16rpx] bg-[#f7f7fb] px-[16rpx] py-[14rpx]"
        >
          <text class="block text-[20rpx] leading-[1.7] text-[#4c4b6c]">
            {{ item }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>
