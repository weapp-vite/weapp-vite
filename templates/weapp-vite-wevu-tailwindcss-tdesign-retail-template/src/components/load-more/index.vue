<script setup lang="ts">
import { toRefs } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class', 'wr-class--no-more'],
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  status?: number
  loadingText?: string
  noMoreText?: string
  failedText?: string
  color?: string
  failedColor?: string
  size?: string | number
  loadingBackgroundColor?: string
  listIsEmpty?: boolean
}>(), {
  status: 0,
  loadingText: '加载中...',
  noMoreText: '没有更多了',
  failedText: '加载失败，点击重试',
  color: '#BBBBBB',
  failedColor: '#FA550F',
  size: '40rpx',
  loadingBackgroundColor: '#F5F5F5',
  listIsEmpty: false,
})

const emit = defineEmits<{
  retry: []
}>()

const {
  status,
  loadingText,
  noMoreText,
  failedText,
  color,
  failedColor,
  size,
  loadingBackgroundColor,
  listIsEmpty,
} = toRefs(props)

function tapHandle() {
  if (status.value === 3) {
    emit('retry')
  }
}

defineExpose({
  status,
  loadingText,
  noMoreText,
  failedText,
  color,
  failedColor,
  size,
  loadingBackgroundColor,
  listIsEmpty,
  tapHandle,
})
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
      <template #content>
        <text>
          {{ noMoreText }}
        </text>
      </template>
    </t-divider>

    <!-- 加载失败 -->
    <view class="load-more__error [margin:auto]" wx:if="{{status===3}}">
      加载失败
      <text class="load-more__refresh-btn [margin-left:16rpx] [color:#fa4126]" bind:tap="tapHandle">
        刷新
      </text>
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
}
</json>
