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
</script>

<template>
  <t-popup
    visible="{{visible}}"
    placement="right"
    bind:visible-change="close"
    data-index="5"
    close-btn="{{closeBtn}}"
  >
    <view class="content [&_.filter-btns-wrap]:[width:100%] [&_.filter-btns-wrap]:[position:absolute] [&_.filter-btns-wrap]:[bottom:calc(20rpx_+_env(safe-area-inset-bottom))] [&_.filter-btns-wrap]:[display:flex] [&_.filter-btns-wrap]:[flex-direction:row] [&_.filter-btns-wrap]:[border-radius:10rpx_0_0_10rpx] [&_.filter-btns-wrap]:[padding:16rpx_32rpx] [&_.filter-btns-wrap]:[border-top:1rpx_solid_#e5e5e5] [&_.filter-btns-wrap]:[box-sizing:border-box]">
      <slot name="filterSlot" />
      <view class="filter-btns-wrap">
        <view class="filter-btn btn-reset [flex:1] [display:flex] [justify-content:center] [align-items:center] [font-size:28rpx] [font-weight:500] [height:80rpx] [color:#fa4126] [background:rgba(255,_255,_255,_1)] [position:relative] [border:1rpx_solid_#fa4126] [border-radius:84rpx_0_0_84rpx]" bind:tap="reset">
          重置
        </view>
        <view class="filter-btn btn-confirm [flex:1] [display:flex] [justify-content:center] [align-items:center] [font-size:28rpx] [font-weight:500] [height:80rpx] [border-radius:0_84rpx_84rpx_0] [border:1rpx_solid_#fa4126] [color:#fff] [background:#fa4126]" bind:tap="confirm" data-index="5">
          确定
        </view>
      </view>
    </view>
  </t-popup>
</template>

<json>
{
    "component": true,
    "usingComponents": {
        "t-popup": "tdesign-miniprogram/popup/popup"
    }
}
</json>
