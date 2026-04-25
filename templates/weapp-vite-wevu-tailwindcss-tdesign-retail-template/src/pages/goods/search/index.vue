<script setup lang="ts">
import { onShow, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { getSearchHistory, getSearchPopular } from '../../../services/good/fetchSearchHistory'

const historyWords = ref<string[]>([])
const popularWords = ref<string[]>([])
const searchValue = ref('')
const dialog = ref({
  title: '确认删除当前历史记录',
  showCancelButton: true,
  message: '',
})
const dialogShow = ref(false)

const deleteType = ref(0)
const deleteIndex = ref<number | ''>('')

async function queryHistory() {
  try {
    const data = await getSearchHistory()
    const code = 'Success'
    if (String(code).toUpperCase() === 'SUCCESS') {
      const { historyWords: nextHistoryWords = [] } = data as { historyWords?: string[] }
      historyWords.value = Array.isArray(nextHistoryWords) ? nextHistoryWords : []
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function queryPopular() {
  try {
    const data = await getSearchPopular()
    const code = 'Success'
    if (String(code).toUpperCase() === 'SUCCESS') {
      const { popularWords: nextPopularWords = [] } = data as { popularWords?: string[] }
      popularWords.value = Array.isArray(nextPopularWords) ? nextPopularWords : []
    }
  }
  catch (error) {
    console.error(error)
  }
}

function confirm() {
  if (deleteType.value === 0 && typeof deleteIndex.value === 'number') {
    historyWords.value.splice(deleteIndex.value, 1)
  }
  else {
    historyWords.value = []
  }
  dialogShow.value = false
}

function close() {
  dialogShow.value = false
}

function handleClearHistory() {
  deleteType.value = 1
  dialog.value = {
    ...dialog.value,
    message: '确认删除所有历史记录',
  }
  dialogShow.value = true
}

function deleteCurr(e: any) {
  const index = Number(e?.currentTarget?.dataset?.index)
  deleteIndex.value = Number.isFinite(index) ? index : ''
  dialog.value = {
    ...dialog.value,
    message: '确认删除当前历史记录',
  }
  dialogShow.value = true
}

async function handleHistoryTap(e: any) {
  const index = Number(e?.currentTarget?.dataset?.index || 0)
  const nextSearchValue = historyWords.value[index] || ''
  if (nextSearchValue) {
    await wpi.navigateTo({
      url: `/pages/goods/result/index?searchValue=${nextSearchValue}`,
    })
  }
}

async function handleSubmit(e: any) {
  const value = e?.detail?.value?.value || ''
  if (typeof value !== 'string' || value.length === 0) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/result/index?searchValue=${value}`,
  })
}

onShow(() => {
  void queryHistory()
  void queryPopular()
})

defineExpose({
  historyWords,
  popularWords,
  searchValue,
  dialog,
  dialogShow,
  confirm,
  close,
  handleClearHistory,
  deleteCurr,
  handleHistoryTap,
  handleSubmit,
})

definePageJson({
  navigationBarTitleText: '搜索',
  usingComponents: {
    't-search': 'tdesign-miniprogram/search/search',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
  },
})
</script>

<template>
  <view class="search-page box-border w-screen h-screen p-[0_30rpx] [&_.t-class__input-container]:h-[64rpx] [&_.t-class__input-container]:rounded-[32rpx] [&_.t-search__input]:text-[28rpx] [&_.t-search__input]:text-[#333] [&_.search-wrap]:mt-[44rpx] [&_.history-wrap]:mb-5 [&_.search-header]:flex [&_.search-header]:[flex-flow:row_nowrap] [&_.search-header]:justify-between [&_.search-header]:items-center [&_.search-title]:text-[30rpx] [&_.search-title]:font-[PingFangSC-Semibold,PingFang_SC] [&_.search-title]:font-semibold [&_.search-title]:text-[rgba(51,51,51,1)] [&_.search-title]:leading-[42rpx] [&_.search-clear]:text-[24rpx] [&_.search-clear]:font-[PingFang_SC] [&_.search-clear]:leading-[32rpx] [&_.search-clear]:text-[#999999] [&_.search-clear]:[font-weight:normal] [&_.search-content]:overflow-hidden [&_.search-content]:flex [&_.search-content]:[flex-flow:row_wrap] [&_.search-content]:justify-start [&_.search-content]:items-start [&_.search-content]:mt-[24rpx] [&_.search-item]:text-[#333333] [&_.search-item]:text-[24rpx] [&_.search-item]:leading-[32rpx] [&_.search-item]:[font-weight:normal] [&_.search-item]:mr-[24rpx] [&_.search-item]:mb-[24rpx] [&_.search-item]:[background:#f5f5f5] [&_.search-item]:rounded-[38rpx] [&_.search-item]:p-[12rpx_24rpx] [&_.hover-history-item]:relative [&_.hover-history-item]:top-[3rpx] [&_.hover-history-item]:left-[3rpx] [&_.hover-history-item]:[box-shadow:0px_0px_8px_rgba(0,0,0,0.1)_inset]">
    <t-search
      t-class-input-container="t-class__input-container"
      t-class-input="t-search__input"
      :value="searchValue"
      leftIcon=""
      placeholder="iPhone12pro"
      focus
      @submit="handleSubmit"
    >
      <template #left-icon>
        <t-icon prefix="wr" name="search" size="40rpx" color="#bbb" />
      </template>
    </t-search>
    <view class="search-wrap">
      <view class="history-wrap">
        <view class="search-header">
          <text class="search-title">
            历史搜索
          </text>
          <text class="search-clear" @tap="handleClearHistory">
            清除
          </text>
        </view>
        <view class="search-content">
          <view
            v-for="(item, index) in historyWords"
            :key="item"
            class="search-item"
            hover-class="hover-history-item"
            :data-index="index"
            @tap="handleHistoryTap"
            @longpress="deleteCurr"
          >
            {{ item }}
          </view>
        </view>
      </view>
      <view class="popular-wrap">
        <view class="search-header">
          <text class="search-title">
            热门搜索
          </text>
        </view>
        <view class="search-content">
          <view
            v-for="(item, index) in popularWords"
            :key="item"
            class="search-item"
            hover-class="hover-history-item"
            :data-index="index"
            @tap="handleHistoryTap"
          >
            {{ item }}
          </view>
        </view>
      </view>
    </view>
    <t-dialog
      :visible="dialogShow"
      :content="dialog.message"
      confirm-btn="确定"
      :cancel-btn="dialog.showCancelButton ? '取消' : null"
      t-class-confirm="dialog__button-confirm"
      t-class-cancel="dialog__button-cancel"
      @confirm="confirm"
      @close="close"
    />
  </view>
</template>
