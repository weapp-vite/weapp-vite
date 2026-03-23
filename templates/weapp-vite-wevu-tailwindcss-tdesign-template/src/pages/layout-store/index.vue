<script setup lang="ts">
import { onUnload, setPageLayout, storeToRefs, watch } from 'wevu'
import SectionTitle from '@/components/SectionTitle/index.vue'
import { useDialog } from '@/hooks/useDialog'
import { useToast } from '@/hooks/useToast'
import { useLayoutInteractionDemoStore } from '@/stores/layoutInteractionDemo'

definePageJson({
  navigationBarTitleText: 'Store 调用 Layout',
  backgroundColor: '#f6f7fb',
})

const store = useLayoutInteractionDemoStore()
const { activeLayout, adminLayoutProps, commandStatus, lastResult, logs, pendingCommand } = storeToRefs(store)
const { showToast } = useToast({ duration: 1400 })
const { alert, confirm } = useDialog()

watch([activeLayout, adminLayoutProps], ([layout, props]) => {
  if (layout === 'admin') {
    setPageLayout('admin', props)
    return
  }
  setPageLayout('default')
}, { immediate: true })

watch(pendingCommand, async (command) => {
  if (!command) {
    return
  }

  if (command.type === 'toast') {
    showToast(command.content)
    store.finishCommand(`${command.title} 已由 ${activeLayout.value} layout 宿主展示`)
    return
  }

  if (command.type === 'alert') {
    await alert({
      title: command.title,
      content: command.content,
      confirmBtn: '知道了',
    })
    store.finishCommand(`${command.title} 已确认`)
    return
  }

  try {
    await confirm({
      title: command.title,
      content: command.content,
      confirmBtn: '确认',
      cancelBtn: '取消',
    })
    store.finishCommand(`${command.title} 点击确认`)
  }
  catch {
    store.finishCommand(`${command.title} 点击取消`)
  }
}, { immediate: true })

function useDefaultLayout() {
  store.setLayout('default')
}

function useAdminLayout() {
  store.setLayout('admin')
}

function openToastByStore() {
  store.triggerToast()
}

function openAlertByStore() {
  store.triggerAlert()
}

function openConfirmByStore() {
  store.triggerConfirm()
}

function clearLogs() {
  store.resetLogs()
}

onUnload(() => {
  setPageLayout('default')
})
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#e8f1ff] via-[#ffffff] to-[#eef2ff] p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.06)]">
      <SectionTitle title="Store 驱动 Layout 交互" subtitle="wevu/store 发起意图，页面上下文消费后命中 layout 内的 toast / dialog 宿主" />
      <text class="mt-[12rpx] block text-[22rpx] leading-[1.7] text-[#5b5b7b]">
        推荐边界是 store 只保存布局状态和交互意图，真正调用 useToast() / useDialog() / setPageLayout() 仍由页面执行，这样不会把 page runtime hook 直接塞进 store。
      </text>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="当前状态" subtitle="观察 store 对布局和宿主交互的描述" />
      <view class="mt-[16rpx] flex flex-col gap-[12rpx]">
        <view class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]">
          <text class="text-[24rpx] font-semibold text-[#1f1a3f]">
            当前布局：{{ activeLayout }}
          </text>
          <text class="mt-[8rpx] block text-[20rpx] leading-[1.7] text-[#6f6b8a]">
            command 状态：{{ commandStatus }}
          </text>
        </view>
        <view class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]">
          <text class="text-[24rpx] font-semibold text-[#1f1a3f]">
            最近结果
          </text>
          <text class="mt-[8rpx] block text-[20rpx] leading-[1.7] text-[#6f6b8a]">
            {{ lastResult }}
          </text>
        </view>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="切换 Layout" subtitle="store 修改布局状态，页面 watch 后调用 setPageLayout()" />
      <view class="mt-[16rpx] flex flex-col gap-[12rpx]">
        <t-button block theme="primary" @tap="useDefaultLayout">
          Store 切到 default 布局
        </t-button>
        <t-button block theme="primary" variant="outline" @tap="useAdminLayout">
          Store 切到 admin 布局
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="触发 Layout 宿主" subtitle="store 发出命令，由页面调用 useToast() / useDialog() 命中当前 layout" />
      <view class="mt-[16rpx] flex flex-col gap-[12rpx]">
        <t-button block theme="primary" @tap="openToastByStore">
          Store 触发 Toast
        </t-button>
        <t-button block theme="primary" variant="outline" @tap="openAlertByStore">
          Store 触发 Alert
        </t-button>
        <t-button block theme="danger" variant="outline" @tap="openConfirmByStore">
          Store 触发 Confirm
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="通信日志" subtitle="记录 store 发出的布局切换与交互命令" />
      <t-button class="mt-[16rpx]" size="small" theme="default" variant="outline" @tap="clearLogs">
        清空日志
      </t-button>
      <view class="mt-[16rpx] flex flex-col gap-[10rpx]">
        <view
          v-for="(item, index) in logs"
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
