<script setup lang="ts">
import { ref, watch } from 'wevu'

interface PickerOption {
  name: string
  code: string | number
}

const props = withDefaults(defineProps<{
  show?: boolean
  title?: string
  value?: string | number
  pickerOptions?: PickerOption[]
  headerVisible?: boolean
}>(), {
  show: false,
  title: '',
  value: '',
  pickerOptions: () => [],
  headerVisible: true,
})

defineOptions({
})

const emit = defineEmits<{
  change: [detail: { value: string | number, target: PickerOption }]
  confirm: [detail: { value: string | number | undefined, target: PickerOption | undefined }]
  close: []
}>()

const pickerValue = ref<number[]>([])

function getAreaByIndex(indexes: number[] | number | string) {
  const index = Array.isArray(indexes)
    ? Number(indexes[0])
    : Number(indexes)
  if (!Number.isInteger(index) || index < 0) {
    return undefined
  }
  return props.pickerOptions[index]
}

function updateDivisions() {
  const list = props.pickerOptions || []
  const targetValue = String(props.value ?? '')
  const index = list.findIndex(item => String(item?.code ?? '') === targetValue)
  // 保持与旧实现一致，延后一次更新以避免 picker-view 初始值不同步。
  setTimeout(() => {
    pickerValue.value = [index >= 0 ? index : 0]
  }, 0)
}

function onChange(e: any) {
  const currentValue = Array.isArray(e?.detail?.value) ? e.detail.value : [0]
  const target = getAreaByIndex(currentValue)
  if (!target) {
    return
  }
  pickerValue.value = currentValue.map((item: any) => Number(item) || 0)
  emit('change', {
    value: target.code,
    target,
  })
}

function onConfirm() {
  const target = getAreaByIndex(pickerValue.value)
  emit('confirm', {
    value: target?.code,
    target,
  })
}

function onClose() {
  emit('close')
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      updateDivisions()
    }
  },
)

watch(
  () => [props.value, props.pickerOptions],
  () => {
    if (props.show) {
      updateDivisions()
    }
  },
  { deep: true },
)

defineExpose({
  pickerValue,
  onChange,
  onConfirm,
  onClose,
})
</script>

<template>
<t-popup visible="{{show}}" placement="bottom">
  <view class="city-picker-box [position:absolute] [bottom:-100%] [transition:0.3s_bottom_ease-in-out] [left:0] [right:0] [z-index:100] [background-color:#fff] [padding:0_30rpx] [color:#333333] [font-size:34rpx] [border-radius:20rpx_20rpx_0_0] [padding-bottom:env(safe-area-inset-bottom)]" slot="content">
    <view wx:if="{{headerVisible}}" class="city-picker-header city-picker-more [height:100rpx] [line-height:100rpx] [text-align:center] [font-size:32rpx] [color:#333333] [display:flex] [justify-content:space-between] [align-items:center]">
      <view class="btn" hover-class="btn__active" catch:tap="onClose">取消</view>
      <view wx:if="{{title}}" class="title">{{title}}</view>
      <view class="btn primary" hover-class="btn__active" catch:tap="onConfirm">确定</view>
    </view>
    <view wx:else class="city-picker-header [height:100rpx] [line-height:100rpx] [text-align:center] [font-size:32rpx] [color:#333333]">
      <view wx:if="{{title}}" class="title">{{title}}</view>
    </view>
    <picker-view class="picker [height:300rpx] [margin:50rpx_0] [line-height:88rpx] [text-align:center]" indicator-class="picker-center-row [height:88rpx]" value="{{pickerValue}}" bind:change="onChange">
      <picker-view-column class="picker-column">
        <view wx:for="{{ pickerOptions }}" wx:key="code">{{ item.name }}</view>
      </picker-view-column>
    </picker-view>
    <view class="city-picker-footer [height:100rpx] [display:flex] [justify-content:space-between] [align-items:center] [&_.btn]:[width:330rpx] [&_.btn]:[height:80rpx] [&_.btn]:[line-height:80rpx] [&_.btn]:[text-align:center] [&_.btn]:[color:#666666] [&_.btn]:[font-size:32rpx] [&_.btn]:[position:relative] [&_.btn__active]:[opacity:0.5] [&_.btn_.primary]:[color:#fa550f]" wx:if="{{!headerVisible}}">
      <view class="btn" hover-class="btn__active" catch:tap="onClose">取消</view>
      <view class="btn primary" hover-class="btn__active" catch:tap="onConfirm">确定</view>
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
