<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true
  },
  properties: {
    currAuthStep: {
      type: Number,
      value: 1
    },
    userInfo: {
      type: Object,
      value: {}
    },
    isNeedGetUserInfo: {
      type: Boolean,
      value: false
    }
  },
  data() {
    return {
      defaultAvatarUrl: 'https://tdesign.gtimg.com/miniprogram/template/retail/usercenter/icon-user-center-avatar@2x.png',
      AuthStepType: {
        ONE: 1,
        TWO: 2,
        THREE: 3
      }
    };
  },
  methods: {
    gotoUserEditPage() {
      this.triggerEvent('gotoUserEditPage');
    }
  }
});
</script>

<template>
<view class="user-center-card [position:fixed] [top:0] [left:0] [width:100%] [height:480rpx] [background-image:url(https://tdesign.gtimg.com/miniprogram/template/retail/template/user-center-bg-v1.png)] [background-size:cover] [background-repeat:no-repeat] [padding:0_24rpx] [background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/template/user-center-bg-v1.png')]">
  <!-- 未登录的情况 -->
  <block wx:if="{{currAuthStep === AuthStepType.ONE}}">
    <view class="user-center-card__header [margin-top:192rpx] [margin-bottom:48rpx] [height:96rpx] [line-height:48rpx] [display:flex] [justify-content:flex-start] [align-items:center] [color:#333] [position:relative]" bind:tap="gotoUserEditPage">
      <t-avatar image="{{userInfo.avatarUrl || defaultAvatarUrl}}" class="user-center-card__header__avatar [width:96rpx] [height:96rpx] [border-radius:48rpx] [overflow:hidden]" />
      <view class="user-center-card__header__name [font-size:36rpx] [line-height:48rpx] [color:#333] [font-weight:bold] [margin-left:24rpx] [margin-right:16rpx]">{{'请登录'}}</view>
    </view>
  </block>
  <!-- 已登录但未授权用户信息情况 -->
  <block wx:if="{{currAuthStep === AuthStepType.TWO}}">
    <view class="user-center-card__header [margin-top:192rpx] [margin-bottom:48rpx] [height:96rpx] [line-height:48rpx] [display:flex] [justify-content:flex-start] [align-items:center] [color:#333] [position:relative]">
      <t-avatar image="{{userInfo.avatarUrl || defaultAvatarUrl}}" class="user-center-card__header__avatar [width:96rpx] [height:96rpx] [border-radius:48rpx] [overflow:hidden]" />
      <view class="user-center-card__header__name [font-size:36rpx] [line-height:48rpx] [color:#333] [font-weight:bold] [margin-left:24rpx] [margin-right:16rpx]">{{userInfo.nickName || '微信用户'}}</view>
      <!-- 需要授权用户信息，通过slot添加弹窗 -->
      <view class="user-center-card__header__transparent [position:absolute] [left:0] [top:0] [background-color:transparent] [height:100%] [width:100%]" wx:if="{{isNeedGetUserInfo}}">
        <slot name="getUserInfo" />
      </view>
      <!-- 不需要授权用户信息，仍然触发gotoUserEditPage事件 -->
      <view class="user-center-card__header__transparent [position:absolute] [left:0] [top:0] [background-color:transparent] [height:100%] [width:100%]" bind:tap="gotoUserEditPage" wx:else></view>
    </view>
  </block>
  <!-- 已登录且已经授权用户信息的情况 -->
  <block wx:if="{{currAuthStep === AuthStepType.THREE}}">
    <view class="user-center-card__header [margin-top:192rpx] [margin-bottom:48rpx] [height:96rpx] [line-height:48rpx] [display:flex] [justify-content:flex-start] [align-items:center] [color:#333] [position:relative]" bind:tap="gotoUserEditPage">
      <t-avatar
        t-class="avatar"
        mode="aspectFill"
        class="user-center-card__header__avatar [width:96rpx] [height:96rpx] [border-radius:48rpx] [overflow:hidden]"
        image="{{userInfo.avatarUrl || defaultAvatarUrl}}"
      />
      <view class="user-center-card__header__name [font-size:36rpx] [line-height:48rpx] [color:#333] [font-weight:bold] [margin-left:24rpx] [margin-right:16rpx]">{{userInfo.nickName || '微信用户'}}</view>
    </view>
  </block>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-avatar": "tdesign-miniprogram/avatar/avatar"
  }
}</json>
