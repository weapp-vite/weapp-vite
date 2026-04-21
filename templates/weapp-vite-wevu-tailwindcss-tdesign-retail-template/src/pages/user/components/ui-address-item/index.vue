<script setup lang="ts">
defineOptions({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  externalClasses: ['item-wrapper-class', 'title-class', 'default-tag-class', 'normal-tag-class', 'address-info-class', 'delete-class'],
})

withDefaults(defineProps<{
  address?: Record<string, any>
  customIcon?: string
  extraSpace?: boolean
  isDrawLine?: boolean
  classPrefix?: string
}>(), {
  address: () => ({}),
  customIcon: 'edit-1',
  extraSpace: true,
  isDrawLine: true,
  classPrefix: 'wr',
})
const emit = defineEmits<{
  onDelete: [detail: any]
  onSelect: [detail: any]
  onEdit: [detail: any]
}>()

function hidePhoneNumber(value: string) {
  return `${value.substring(0, 3)}****${value.substring(7)}`
}

function onDelete(e: any) {
  emit('onDelete', e?.currentTarget?.dataset?.item)
}

function onSelect(e: any) {
  emit('onSelect', e?.currentTarget?.dataset?.item)
}

function onEdit(e: any) {
  emit('onEdit', e?.currentTarget?.dataset?.item)
}

defineExpose({
  onDelete,
  onSelect,
  onEdit,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-tag': 'tdesign-miniprogram/tag/tag',
    't-swipe-cell': 'tdesign-miniprogram/swipe-cell/swipe-cell',
  },
})
</script>

<template>
  <view class="address-item-wrapper item-wrapper-class overflow-hidden [&_.swipe-out_.wr-swiper-cell]:mt-[20rpx] [&_.swipe-out_.swipe-right-del]:flex [&_.swipe-out_.swipe-right-del]:justify-center [&_.swipe-out_.swipe-right-del]:items-center [&_.swipe-out_.swipe-right-del]:w-[144rpx] [&_.swipe-out_.swipe-right-del]:h-full [&_.swipe-out_.swipe-right-del]:bg-[#fa4126] [&_.swipe-out_.swipe-right-del]:text-white [&_.swipe-out_.swipe-right-del]:text-[28rpx] [&_.swipe-out_.swipe-right-del]:leading-[40rpx] [&_.draw-line]:relative [&_.address]:flex [&_.address]:justify-between [&_.address]:items-center [&_.address]:p-[32rpx] [&_.address]:bg-white [&_.address_.address-edit]:p-[20rpx_0_20rpx_46rpx] [&_.address_.address-left]:w-[80rpx] [&_.address_.address-left]:flex [&_.address_.address-left]:justify-center [&_.address_.address-content]:flex [&_.address_.address-content]:flex-col [&_.address_.address-content]:flex-1 [&_.address_.address-content_.title]:text-[32rpx] [&_.address_.address-content_.title]:leading-[48rpx] [&_.address_.address-content_.title]:mb-[16rpx] [&_.address_.address-content_.title]:text-[#333333] [&_.address_.address-content_.title]:[font-weight:bold] [&_.address_.address-content_.title]:flex [&_.address_.address-content_.title_.text-style]:mr-[8rpx] [&_.address_.address-content_.title_.text-style]:truncate [&_.address_.address-content_.title_.text-style]:max-w-[280rpx] [&_.address_.address-content_.label-adds]:flex [&_.address_.address-content_.label-adds_.adds]:line-clamp-2 [&_.address_.address-content_.label-adds_.adds]:text-ellipsis [&_.address_.address-content_.label-adds_.adds]:text-[#999999] [&_.address_.address-content_.label-adds_.tag]:inline-block [&_.address_.address-content_.label-adds_.tag]:p-[0rpx_8rpx] [&_.address_.address-content_.label-adds_.tag]:min-w-[40rpx] [&_.address_.address-content_.label-adds_.tag]:h-[32rpx] [&_.address_.address-content_.label-adds_.tag]:rounded-[18rpx] [&_.address_.address-content_.label-adds_.tag]:text-[20rpx] [&_.address_.address-content_.label-adds_.tag]:leading-[32rpx] [&_.address_.address-content_.label-adds_.tag]:text-center [&_.address_.address-content_.label-adds_.tag]:mr-[8rpx] [&_.address_.address-content_.label-adds_.tag]:align-text-top [&_.address_.address-content_.label-adds_.tag-default]:[background:#ffece9] [&_.address_.address-content_.label-adds_.tag-default]:text-[#fa4126] [&_.address_.address-content_.label-adds_.tag-primary]:[background:#f0f1ff] [&_.address_.address-content_.label-adds_.tag-primary]:text-[#5a66ff] [&_.address_.address-content_.label-adds_.address-text]:text-[28rpx] [&_.address_.address-content_.label-adds_.address-text]:leading-[40rpx] [&_.address_.address-content_.label-adds_.address-text]:text-[#999999]">
    <t-swipe-cell class="swipe-out">
      <view :class="`address ${isDrawLine ? 'draw-line' : ''}`" :data-item="address" @tap="onSelect">
        <view v-if="extraSpace" class="address-left">
          <t-icon v-if="address.checked" name="check" color="#FA4126" :class-prefix="classPrefix" size="46rpx" />
        </view>
        <view class="address-content">
          <view class="title title-class">
            <text class="text-style">
              {{ address.name }}
            </text>
            <text>{{ hidePhoneNumber(address.phoneNumber || '') }}</text>
          </view>
          <view class="label-adds">
            <text class="adds address-info-class">
              <text v-if="address.isDefault === 1" class="tag tag-default default-tag-class">
                默认
              </text>
              <text v-if="address.tag" class="tag tag-primary normal-tag-class">
                {{ address.tag }}
              </text>
              <text class="address-text">
                {{ address.address }}
              </text>
            </text>
          </view>
        </view>
        <view :data-item="address" class="address-edit" @tap.stop="onEdit">
          <t-icon :name="customIcon" :class-prefix="classPrefix" size="46rpx" color="#BBBBBB" />
        </view>
      </view>
      <template #right>
        <view class="swipe-right-del delete-class" :data-item="address" @tap="onDelete">
          删除
        </view>
      </template>
    </t-swipe-cell>
  </view>
</template>
