<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class', 'wr-class--no-more'],
  options: {
    multipleSlots: true
  },
  properties: {
    status: {
      type: Number,
      value: 0
    },
    loadingText: {
      type: String,
      value: '加载中...'
    },
    noMoreText: {
      type: String,
      value: '没有更多了'
    },
    failedText: {
      type: String,
      value: '加载失败，点击重试'
    },
    color: {
      type: String,
      value: '#BBBBBB'
    },
    failedColor: {
      type: String,
      value: '#FA550F'
    },
    size: {
      type: null,
      value: '40rpx'
    },
    loadingBackgroundColor: {
      type: String,
      value: '#F5F5F5'
    },
    listIsEmpty: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    /** 点击处理 */
    tapHandle() {
      // 失败重试
      if (this.data.status === 3) {
        this.triggerEvent('retry');
      }
    }
  }
});
</script>

<template>
<view
  class="load-more wr-class [font-size:24rpx] [height:100rpx] [display:flex] [flex-direction:column] [justify-content:center] [&_.t-class-loading]:[display:flex] [&_.t-class-loading]:[justify-content:center] [&_.t-class-loading-text]:[color:#bbbbbb] [&_.t-class-indicator]:[color:#b9b9b9]"
  wx:if="{{!(listIsEmpty && (status === 0 || status === 2))}}"
  bindtap="tapHandle"
>
  <!-- 加载中 -->

  <t-loading
    t-class="t-class-loading"
    t-class-text="t-class-loading-text"
    t-class-indicator="t-class-indicator"
    loading="{{status === 1}}"
    text="加载中..."
    theme="circular"
    size="40rpx"
  />

  <!-- 已全部加载 -->
  <t-divider wx:if="{{status === 2}}" t-class="t-class-divider" t-class-content="t-class-divider-content">
    <text slot="content">{{noMoreText}}</text>
  </t-divider>

  <!-- 加载失败 -->
  <view class="load-more__error [margin:auto]" wx:if="{{status===3}}">
    加载失败
    <text class="load-more__refresh-btn [margin-left:16rpx] [color:#fa4126]" bind:tap="tapHandle">刷新</text>
  </view>
</view>

<!-- 支持通过slot传入页面/列表的空态，load-more来控制空态的显示状态 -->
<slot wx:if="{{listIsEmpty && (status === 0 || status === 2)}}" name="empty" />
</template>

<json>
{
    "component": true,
    "usingComponents": {
        "t-loading": "tdesign-miniprogram/loading/loading",
        "t-divider": "tdesign-miniprogram/divider/divider"
    }
}</json>
