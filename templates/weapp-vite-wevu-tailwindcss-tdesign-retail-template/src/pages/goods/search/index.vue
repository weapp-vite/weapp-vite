<script setup lang="ts">
import { onShow, ref } from 'wevu';
import { getSearchHistory, getSearchPopular } from '../../../services/good/fetchSearchHistory';

const historyWords = ref<string[]>([]);
const popularWords = ref<string[]>([]);
const searchValue = ref('');
const dialog = ref({
  title: '确认删除当前历史记录',
  showCancelButton: true,
  message: '',
});
const dialogShow = ref(false);

const deleteType = ref(0);
const deleteIndex = ref<number | ''>('');

async function queryHistory() {
  try {
    const data = await getSearchHistory();
    const code = 'Success';
    if (String(code).toUpperCase() === 'SUCCESS') {
      const { historyWords: nextHistoryWords = [] } = data as { historyWords?: string[] };
      historyWords.value = Array.isArray(nextHistoryWords) ? nextHistoryWords : [];
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function queryPopular() {
  try {
    const data = await getSearchPopular();
    const code = 'Success';
    if (String(code).toUpperCase() === 'SUCCESS') {
      const { popularWords: nextPopularWords = [] } = data as { popularWords?: string[] };
      popularWords.value = Array.isArray(nextPopularWords) ? nextPopularWords : [];
    }
  }
  catch (error) {
    console.error(error);
  }
}

function confirm() {
  if (deleteType.value === 0 && typeof deleteIndex.value === 'number') {
    historyWords.value.splice(deleteIndex.value, 1);
  }
  else {
    historyWords.value = [];
  }
  dialogShow.value = false;
}

function close() {
  dialogShow.value = false;
}

function handleClearHistory() {
  deleteType.value = 1;
  dialog.value = {
    ...dialog.value,
    message: '确认删除所有历史记录',
  };
  dialogShow.value = true;
}

function deleteCurr(e: any) {
  const index = Number(e?.currentTarget?.dataset?.index);
  deleteIndex.value = Number.isFinite(index) ? index : '';
  dialog.value = {
    ...dialog.value,
    message: '确认删除当前历史记录',
  };
  dialogShow.value = true;
}

function handleHistoryTap(e: any) {
  const index = Number(e?.currentTarget?.dataset?.index || 0);
  const nextSearchValue = historyWords.value[index] || '';
  if (nextSearchValue) {
    wx.navigateTo({
      url: `/pages/goods/result/index?searchValue=${nextSearchValue}`,
    });
  }
}

function handleSubmit(e: any) {
  const value = e?.detail?.value?.value || '';
  if (typeof value !== 'string' || value.length === 0) {
    return;
  }
  wx.navigateTo({
    url: `/pages/goods/result/index?searchValue=${value}`,
  });
}

onShow(() => {
  void queryHistory();
  void queryPopular();
});

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
});
</script>

<template>
<view class="search-page [box-sizing:border-box] [width:100vw] [height:100vh] [padding:0_30rpx] [&_.t-class__input-container]:[height:64rpx] [&_.t-class__input-container]:[border-radius:32rpx] [&_.t-search__input]:[font-size:28rpx] [&_.t-search__input]:[color:#333] [&_.search-wrap]:[margin-top:44rpx] [&_.history-wrap]:[margin-bottom:20px] [&_.search-header]:[display:flex] [&_.search-header]:[flex-flow:row_nowrap] [&_.search-header]:[justify-content:space-between] [&_.search-header]:[align-items:center] [&_.search-title]:[font-size:30rpx] [&_.search-title]:[font-family:PingFangSC-Semibold,_PingFang_SC] [&_.search-title]:[font-weight:600] [&_.search-title]:[color:rgba(51,_51,_51,_1)] [&_.search-title]:[line-height:42rpx] [&_.search-clear]:[font-size:24rpx] [&_.search-clear]:[font-family:PingFang_SC] [&_.search-clear]:[line-height:32rpx] [&_.search-clear]:[color:#999999] [&_.search-clear]:[font-weight:normal] [&_.search-content]:[overflow:hidden] [&_.search-content]:[display:flex] [&_.search-content]:[flex-flow:row_wrap] [&_.search-content]:[justify-content:flex-start] [&_.search-content]:[align-items:flex-start] [&_.search-content]:[margin-top:24rpx] [&_.search-item]:[color:#333333] [&_.search-item]:[font-size:24rpx] [&_.search-item]:[line-height:32rpx] [&_.search-item]:[font-weight:normal] [&_.search-item]:[margin-right:24rpx] [&_.search-item]:[margin-bottom:24rpx] [&_.search-item]:[background:#f5f5f5] [&_.search-item]:[border-radius:38rpx] [&_.search-item]:[padding:12rpx_24rpx] [&_.hover-history-item]:[position:relative] [&_.hover-history-item]:[top:3rpx] [&_.hover-history-item]:[left:3rpx] [&_.hover-history-item]:[box-shadow:0px_0px_8px_rgba(0,_0,_0,_0.1)_inset]">
  <t-search
    t-class-input-container="t-class__input-container"
    t-class-input="t-search__input"
    value="{{searchValue}}"
    leftIcon=""
    placeholder="iPhone12pro"
    bind:submit="handleSubmit"
    focus
  >
    <t-icon slot="left-icon" prefix="wr" name="search" size="40rpx" color="#bbb" />
  </t-search>
  <view class="search-wrap">
    <view class="history-wrap">
      <view class="search-header">
        <text class="search-title">历史搜索</text>
        <text class="search-clear" bind:tap="handleClearHistory">清除</text>
      </view>
      <view class="search-content">
        <view
          class="search-item"
          hover-class="hover-history-item"
          wx:for="{{historyWords}}"
          bind:tap="handleHistoryTap"
          bindlongpress="deleteCurr"
          data-index="{{index}}"
          wx:key="*this"
        >
          {{item}}
        </view>
      </view>
    </view>
    <view class="popular-wrap">
      <view class="search-header">
        <text class="search-title">热门搜索</text>
      </view>
      <view class="search-content">
        <view
          class="search-item"
          hover-class="hover-history-item"
          wx:for="{{popularWords}}"
          bind:tap="handleHistoryTap"
          data-index="{{index}}"
          wx:key="*this"
        >
          {{item}}
        </view>
      </view>
    </view>
  </view>
  <t-dialog
    visible="{{dialogShow}}"
    content="{{dialog.message}}"
    bindconfirm="confirm"
    bind:close="close"
    confirm-btn="确定"
    cancel-btn="{{dialog.showCancelButton ? '取消' : null}}"
    t-class-confirm="dialog__button-confirm"
    t-class-cancel="dialog__button-cancel"
  />
</view>
</template>

<json>
{
  "navigationBarTitleText": "搜索",
  "usingComponents": {
    "t-search": "tdesign-miniprogram/search/search",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-dialog": "tdesign-miniprogram/dialog/dialog"
  }
}
</json>
