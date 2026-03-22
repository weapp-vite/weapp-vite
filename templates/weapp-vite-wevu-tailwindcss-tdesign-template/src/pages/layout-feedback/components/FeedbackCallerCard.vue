<script setup lang="ts">
import { ref } from 'wevu'
import { useDialog } from '@/hooks/useDialog'
import { useToast } from '@/hooks/useToast'

const props = defineProps<{
  onReport?: (payload: string) => void
}>()

const actionSeed = ref(0)
const { showToast } = useToast({ duration: 1400 })
const { alert, confirm } = useDialog()

function nextLabel(prefix: string) {
  actionSeed.value += 1
  return `${prefix} #${actionSeed.value}`
}

function triggerChildToast() {
  const label = nextLabel('子组件 Toast')
  showToast(`${label} 已通过 layout 宿主触发`)
  props.onReport?.(`${label} 已触发`)
}

function triggerChildAlert() {
  const label = nextLabel('子组件 Alert')
  void alert({
    title: label,
    content: '当前弹窗由子组件直接调用 useDialog()，但实际宿主仍在 layout 内。',
    confirmBtn: '知道了',
  }).then(() => {
    props.onReport?.(`${label} 已确认`)
  })
}

function triggerChildConfirm() {
  const label = nextLabel('子组件 Confirm')
  void confirm({
    title: label,
    content: '点击确认后会回传一条日志，证明子组件与页面都能经由同一 layout 宿主通信。',
    confirmBtn: '确认',
    cancelBtn: '取消',
  }).then(() => {
    props.onReport?.(`${label} 点击确认`)
  }).catch(() => {
    props.onReport?.(`${label} 点击取消`)
  })
}
</script>

<template>
  <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
    <view class="flex items-center justify-between">
      <view>
        <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
          子组件直连 layout 宿主
        </text>
        <text class="mt-[6rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
          这个组件不接收 toast/dialog 实例，也不手动 selectComponent，只直接调用 useToast() / useDialog()。
        </text>
      </view>
      <t-tag size="small" theme="primary" variant="light">
        Child
      </t-tag>
    </view>

    <view class="mt-[18rpx] flex flex-col gap-[12rpx]">
      <t-button block theme="primary" variant="outline" @tap="triggerChildToast">
        子组件触发 Toast
      </t-button>
      <t-button block theme="primary" variant="outline" @tap="triggerChildAlert">
        子组件触发 Alert
      </t-button>
      <t-button block theme="danger" variant="outline" @tap="triggerChildConfirm">
        子组件触发 Confirm
      </t-button>
    </view>
  </view>
</template>
