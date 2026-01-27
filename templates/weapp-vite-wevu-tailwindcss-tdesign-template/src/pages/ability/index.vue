<script setup lang="ts">
import { ref } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'
import { useDialog } from '@/hooks/useDialog'
import { useToast } from '@/hooks/useToast'

definePageJson({
  navigationBarTitleText: '能力',
  backgroundColor: '#f6f7fb',
})

const { alert } = useDialog()
const { showToast } = useToast()

const capabilityCards = ref([
  {
    key: 'scan',
    title: '扫一扫',
    desc: '识别条码或二维码',
  },
  {
    key: 'location',
    title: '定位',
    desc: '获取当前坐标',
  },
  {
    key: 'clipboard',
    title: '剪贴板',
    desc: '写入演示文本',
  },
  {
    key: 'share',
    title: '分享',
    desc: '唤起分享菜单',
  },
  {
    key: 'image',
    title: '选择图片',
    desc: '上传素材预览',
  },
])

const subscribeTemplateId = ''

function handleCapability(key: string, what: any) {
  console.log('handleCapability', key, what)
  switch (key) {
    case 'scan':
      wx.scanCode({
        success: (result) => {
          showToast(`识别结果：${result.result || '已完成'}`)
        },
        fail: () => {
          showToast('扫码失败，请重试', 'warning')
        },
      })
      break
    case 'location':
      wx.getLocation({
        type: 'wgs84',
        success: (result) => {
          showToast(`定位成功：${result.latitude.toFixed(2)}, ${result.longitude.toFixed(2)}`)
        },
        fail: () => {
          showToast('未获取定位权限', 'warning')
        },
      })
      break
    case 'clipboard':
      wx.setClipboardData({
        data: 'weapp-vite + wevu + TDesign',
        success: () => showToast('已写入剪贴板'),
      })
      break
    case 'share':
      wx.showShareMenu({
        withShareTicket: true,
        success: () => showToast('已开启分享菜单'),
        fail: () => showToast('分享菜单开启失败', 'warning'),
      })
      break
    case 'image':
      wx.chooseImage({
        count: 3,
        success: (result) => {
          showToast(`已选择 ${result.tempFilePaths.length} 张图片`)
        },
        fail: () => showToast('未选择图片', 'warning'),
      })
      break
    default:
      break
  }
}

function requestSubscribe() {
  if (!subscribeTemplateId) {
    alert({
      title: '订阅消息',
      content: '请在 ability 页面配置订阅模板 ID 后再试。',
      confirmBtn: '知道了',
    })
    return
  }
  wx.requestSubscribeMessage({
    tmplIds: [subscribeTemplateId],
    success: () => showToast('订阅成功'),
    fail: () => showToast('订阅失败', 'warning'),
  })
}

function navigateTo(url: string) {
  wx.navigateTo({
    url,
  })
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#ecfeff] via-[#ffffff] to-[#e0f2fe] p-[20rpx]">
      <SectionTitle title="小程序能力" subtitle="本页展示原生 API 与分包导航" />
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="常用能力" subtitle="点击体验微信原生 API" />
      <view class="mt-[12rpx] grid grid-cols-2 gap-[12rpx]">
        <view
          v-for="item in capabilityCards"
          :key="item.key"
          class="rounded-[18rpx] bg-[#f0f9ff] p-[16rpx]"
          @tap="handleCapability(item.key, 'test')"
        >
          <text class="text-[24rpx] font-semibold text-[#1f1a3f]">
            {{ item.title }}
          </text>
          <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
            {{ item.desc }}
          </text>
        </view>
      </view>
      <view class="mt-[16rpx]">
        <t-button block theme="primary" variant="outline" @tap="requestSubscribe">
          订阅消息提醒
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="分包演示" subtitle="weapp-vite 子包页面" />
      <view class="mt-[12rpx]">
        <t-cell-group>
          <t-cell title="组件实验室" note="subpackages/lab" arrow @tap="navigateTo('/subpackages/lab/index')" />
          <t-cell title="Class 绑定实验室" note="subpackages/lab/class-binding" arrow @tap="navigateTo('/subpackages/lab/class-binding/index')" />
          <t-cell title="API 场景页" note="subpackages/ability" arrow @tap="navigateTo('/subpackages/ability/index')" />
        </t-cell-group>
      </view>
    </view>

    <t-toast id="t-toast" />
    <t-dialog id="t-dialog" />
  </view>
</template>
