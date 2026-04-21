<script setup lang="ts">
import { computed, toRefs } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  show?: boolean
  closeBtn?: boolean
}>(), {
  show: false,
  closeBtn: false,
})

const emit = defineEmits<{
  reset: []
  confirm: []
  showFilterPopupClose: []
}>()

const visible = computed(() => Boolean(props.show))
const { closeBtn } = toRefs(props)

function reset() {
  emit('reset')
}

function confirm() {
  emit('confirm')
}

function close() {
  emit('showFilterPopupClose')
}

defineExpose({
  closeBtn,
  visible,
  reset,
  confirm,
  close,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
  },
})
</script>

<template>
  <t-popup
    :visible="visible"
    placement="right"
    data-index="5"
    :close-btn="closeBtn"
    @visible-change="close"
  >
    <view class="content [&_.filter-btns-wrap]:w-full [&_.filter-btns-wrap]:absolute [&_.filter-btns-wrap]:bottom-[calc(20rpx+env(safe-area-inset-bottom))] [&_.filter-btns-wrap]:flex [&_.filter-btns-wrap]:flex-row [&_.filter-btns-wrap]:rounded-[10rpx_0_0_10rpx] [&_.filter-btns-wrap]:p-[16rpx_32rpx] [&_.filter-btns-wrap]:[border-top:1rpx_solid_#e5e5e5] [&_.filter-btns-wrap]:box-border">
      <slot name="filterSlot" />
      <view class="filter-btns-wrap">
        <view class="filter-btn btn-reset flex-1 flex justify-center items-center text-[28rpx] font-medium h-[80rpx] text-[#fa4126] [background:rgba(255,255,255,1)] relative [border:1rpx_solid_#fa4126] rounded-[84rpx_0_0_84rpx]" @tap="reset">
          重置
        </view>
        <view class="filter-btn btn-confirm flex-1 flex justify-center items-center text-[28rpx] font-medium h-[80rpx] rounded-[0_84rpx_84rpx_0] [border:1rpx_solid_#fa4126] text-white [background:#fa4126]" data-index="5" @tap="confirm">
          确定
        </view>
      </view>
    </view>
  </t-popup>
</template>
