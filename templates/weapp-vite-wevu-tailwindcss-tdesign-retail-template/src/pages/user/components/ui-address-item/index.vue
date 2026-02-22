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
</script>

<template>
<wxs module="phoneReg">
  var toHide = function(array) { var mphone = array.substring(0, 3) + '****' + array.substring(7); return mphone; }
  module.exports.toHide = toHide;
</wxs>
<view class="address-item-wrapper item-wrapper-class [overflow:hidden] [&_.swipe-out_.wr-swiper-cell]:[margin-top:20rpx] [&_.swipe-out_.swipe-right-del]:[display:flex] [&_.swipe-out_.swipe-right-del]:[justify-content:center] [&_.swipe-out_.swipe-right-del]:[align-items:center] [&_.swipe-out_.swipe-right-del]:[width:144rpx] [&_.swipe-out_.swipe-right-del]:[height:100%] [&_.swipe-out_.swipe-right-del]:[background-color:#fa4126] [&_.swipe-out_.swipe-right-del]:[color:#fff] [&_.swipe-out_.swipe-right-del]:[font-size:28rpx] [&_.swipe-out_.swipe-right-del]:[line-height:40rpx] [&_.draw-line]:[position:relative] [&_.address]:[display:flex] [&_.address]:[justify-content:space-between] [&_.address]:[align-items:center] [&_.address]:[padding:32rpx] [&_.address]:[background-color:#fff] [&_.address_.address-edit]:[padding:20rpx_0_20rpx_46rpx] [&_.address_.address-left]:[width:80rpx] [&_.address_.address-left]:[display:flex] [&_.address_.address-left]:[justify-content:center] [&_.address_.address-content]:[display:flex] [&_.address_.address-content]:[flex-direction:column] [&_.address_.address-content]:[flex:1] [&_.address_.address-content_.title]:[font-size:32rpx] [&_.address_.address-content_.title]:[line-height:48rpx] [&_.address_.address-content_.title]:[margin-bottom:16rpx] [&_.address_.address-content_.title]:[color:#333333] [&_.address_.address-content_.title]:[font-weight:bold] [&_.address_.address-content_.title]:[display:flex] [&_.address_.address-content_.title_.text-style]:[margin-right:8rpx] [&_.address_.address-content_.title_.text-style]:[overflow:hidden] [&_.address_.address-content_.title_.text-style]:[text-overflow:ellipsis] [&_.address_.address-content_.title_.text-style]:[white-space:nowrap] [&_.address_.address-content_.title_.text-style]:[max-width:280rpx] [&_.address_.address-content_.label-adds]:[display:flex] [&_.address_.address-content_.label-adds_.adds]:[display:-webkit-box] [&_.address_.address-content_.label-adds_.adds]:[overflow:hidden] [&_.address_.address-content_.label-adds_.adds]:[text-overflow:ellipsis] [&_.address_.address-content_.label-adds_.adds]:[-webkit-box-orient:vertical] [&_.address_.address-content_.label-adds_.adds]:[-webkit-line-clamp:2] [&_.address_.address-content_.label-adds_.adds]:[color:#999999] [&_.address_.address-content_.label-adds_.tag]:[display:inline-block] [&_.address_.address-content_.label-adds_.tag]:[padding:0rpx_8rpx] [&_.address_.address-content_.label-adds_.tag]:[min-width:40rpx] [&_.address_.address-content_.label-adds_.tag]:[height:32rpx] [&_.address_.address-content_.label-adds_.tag]:[border-radius:18rpx] [&_.address_.address-content_.label-adds_.tag]:[font-size:20rpx] [&_.address_.address-content_.label-adds_.tag]:[line-height:32rpx] [&_.address_.address-content_.label-adds_.tag]:[text-align:center] [&_.address_.address-content_.label-adds_.tag]:[margin-right:8rpx] [&_.address_.address-content_.label-adds_.tag]:[vertical-align:text-top] [&_.address_.address-content_.label-adds_.tag-default]:[background:#ffece9] [&_.address_.address-content_.label-adds_.tag-default]:[color:#fa4126] [&_.address_.address-content_.label-adds_.tag-primary]:[background:#f0f1ff] [&_.address_.address-content_.label-adds_.tag-primary]:[color:#5a66ff] [&_.address_.address-content_.label-adds_.address-text]:[font-size:28rpx] [&_.address_.address-content_.label-adds_.address-text]:[line-height:40rpx] [&_.address_.address-content_.label-adds_.address-text]:[color:#999999]">
  <t-swipe-cell class="swipe-out">
    <view class="address {{isDrawLine ? 'draw-line' : ''}}" bindtap="onSelect" data-item="{{address}}">
      <view class="address-left" wx:if="{{extraSpace}}">
        <t-icon wx:if="{{address.checked}}" name="check" color="#FA4126" class-prefix="{{classPrefix}}" size="46rpx" />
      </view>
      <view class="address-content">
        <view class="title title-class">
          <text class="text-style">{{address.name}}</text>
          <text>{{phoneReg.toHide(address.phoneNumber || '')}}</text>
        </view>
        <view class="label-adds">
          <text class="adds address-info-class">
            <text wx:if="{{address.isDefault === 1}}" class="tag tag-default default-tag-class">默认</text>
            <text wx:if="{{address.tag}}" class="tag tag-primary normal-tag-class">{{address.tag}}</text>
            <text class="address-text">{{address.address}}</text>
          </text>
        </view>
      </view>
      <view catch:tap="onEdit" data-item="{{address}}" class="address-edit">
        <t-icon name="{{customIcon}}" class-prefix="{{classPrefix}}" size="46rpx" color="#BBBBBB" />
      </view>
    </view>
    <view slot="right" class="swipe-right-del delete-class" bindtap="onDelete" data-item="{{address}}"> 删除 </view>
  </t-swipe-cell>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-swipe-cell": "tdesign-miniprogram/swipe-cell/swipe-cell"
  }
}
</json>
