<script setup lang="ts">
import { ref, watch } from 'wevu'

interface PickerOption {
  name: string
  code: string | number
}

defineOptions({
})

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
  const detailValue = e?.detail?.value
  const currentValue = Array.isArray(detailValue)
    ? detailValue
    : Array.isArray(e?.target?.value)
      ? e.target.value
      : typeof detailValue === 'number'
        ? [detailValue]
        : [0]
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

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
  },
})
</script>

<template>
  <t-popup :visible="show" placement="bottom">
    <template #content>
      <view class="city-picker-box absolute -bottom-full [transition:0.3s_bottom_ease-in-out] left-0 right-0 z-100 bg-white p-[0_30rpx] text-[#333333] text-[34rpx] rounded-[20rpx_20rpx_0_0] pb-[env(safe-area-inset-bottom)]">
        <view v-if="headerVisible" class="city-picker-header city-picker-more h-[100rpx] leading-[100rpx] text-center text-[32rpx] text-[#333333] flex justify-between items-center">
          <view class="btn" hover-class="btn__active" @tap.stop="onClose">
            取消
          </view>
          <view v-if="title" class="title">
            {{ title }}
          </view>
          <view class="btn primary" hover-class="btn__active" @tap.stop="onConfirm">
            确定
          </view>
        </view>
        <view v-else class="city-picker-header h-[100rpx] leading-[100rpx] text-center text-[32rpx] text-[#333333]">
          <view v-if="title" class="title">
            {{ title }}
          </view>
        </view>
        <picker-view class="picker h-[300rpx] m-[50rpx_0] leading-[88rpx] text-center" indicator-class="picker-center-row [height:88rpx]" :value="pickerValue" @change="onChange">
          <picker-view-column class="picker-column">
            <view v-for="(item, index) in pickerOptions" :key="item.code ?? index">
              {{ item.name }}
            </view>
          </picker-view-column>
        </picker-view>
        <view v-if="!headerVisible" class="city-picker-footer h-[100rpx] flex justify-between items-center [&_.btn]:w-[330rpx] [&_.btn]:h-[80rpx] [&_.btn]:leading-[80rpx] [&_.btn]:text-center [&_.btn]:text-[#666666] [&_.btn]:text-[32rpx] [&_.btn]:relative [&_.btn__active]:opacity-[0.5] [&_.btn_.primary]:text-[#fa550f]">
          <view class="btn" hover-class="btn__active" @tap.stop="onClose">
            取消
          </view>
          <view class="btn primary" hover-class="btn__active" @tap.stop="onConfirm">
            确定
          </view>
        </view>
      </view>
    </template>
  </t-popup>
</template>
