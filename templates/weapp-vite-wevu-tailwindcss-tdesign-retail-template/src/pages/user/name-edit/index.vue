<script lang="ts">
Page({
  data: {
    nameValue: '',
  },
  onLoad(options) {
    const { name } = options;
    this.setData({
      nameValue: name,
    });
  },
  onSubmit() {
    wx.navigateBack({ backRefresh: true });
  },
  clearContent() {
    this.setData({
      nameValue: '',
    });
  },
});
</script>

<template>
<view class="name-edit [padding-top:20rpx] [&_.name-edit__input--desc]:[font-size:26rpx] [&_.name-edit__input--desc]:[padding:16rpx_32rpx] [&_.name-edit__input--desc]:[color:#999] [&_.name-edit__input--desc]:[margin-bottom:200rpx] [&_.name-edit__wrapper]:[margin:0_32rpx]">
  <t-input
    borderless
    model:value="{{nameValue}}"
    placeholder="请输入文字"
    label="昵称"
    clearable
    bind:clear="clearContent"
  />
  <view class="name-edit__input--desc"> 最多可输入15个字 </view>
  <view class="name-edit__wrapper">
    <t-button block shape="round" disabled="{{!nameValue}}" bind:tap="onSubmit">保存</t-button>
  </view>
</view>
</template>

<json>
{
  "navigationBarTitleText": "昵称",
  "usingComponents": {
    "t-input": "tdesign-miniprogram/input/input",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-button": "tdesign-miniprogram/button/button"
  }
}
</json>
