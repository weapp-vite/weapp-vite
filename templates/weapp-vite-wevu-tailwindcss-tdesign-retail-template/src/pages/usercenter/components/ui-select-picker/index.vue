<script setup lang="ts">
defineOptions({
  properties: {
    show: {
      type: Boolean,
      observer(show) {
        if (!show) return;
        this.updateDivisions();
      }
    },
    title: {
      type: String,
      value: ''
    },
    value: {
      type: String,
      value: '',
      observer() {
        if (!this.data.show) return;
        this.updateDivisions();
      }
    },
    pickerOptions: {
      type: Array,
      value: [],
      observer() {
        if (!this.data.show) return;
        this.updateDivisions();
      }
    },
    headerVisible: {
      type: Boolean,
      value: true
    }
  },
  data() {
    return {
      pickerValue: []
    };
  },
  methods: {
    updateDivisions() {
      const {
        pickerOptions,
        value
      } = this.data;
      const index = (pickerOptions || []).findIndex(item => item.code === value);
      setTimeout(() => {
        this.setData({
          pickerValue: index >= 0 ? [index] : [0]
        });
      }, 0);
    },
    getAreaByIndex(indexes) {
      const {
        pickerOptions
      } = this.data;
      return pickerOptions[indexes.toString()];
    },
    onChange(e) {
      const currentValue = e.detail.value;
      const target = this.getAreaByIndex(currentValue);
      if (target === null) return;
      this.setData({
        pickerValue: currentValue
      });
      this.triggerEvent('change', {
        value: target.code,
        target: target
      });
    },
    onConfirm() {
      const target = this.getAreaByIndex(this.data.pickerValue);
      this.triggerEvent('confirm', {
        value: target?.code,
        target
      });
    },
    onClose() {
      this.triggerEvent('close');
    }
  }
});
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
