<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true,
  },
})

withDefaults(defineProps<{
  currAuthStep?: number
  userInfo?: Record<string, any>
  isNeedGetUserInfo?: boolean
}>(), {
  currAuthStep: 1,
  userInfo: () => ({}),
  isNeedGetUserInfo: false,
})

const emit = defineEmits<{
  gotoUserEditPage: []
}>()

const defaultAvatarUrl = 'https://tdesign.gtimg.com/miniprogram/template/retail/usercenter/icon-user-center-avatar@2x.png'
const AuthStepType = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
}

function gotoUserEditPage() {
  emit('gotoUserEditPage')
}

defineExpose({
  defaultAvatarUrl,
  AuthStepType,
  gotoUserEditPage,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-avatar': 'tdesign-miniprogram/avatar/avatar',
  },
})
</script>

<template>
  <view class="user-center-card fixed top-0 left-0 w-full h-[480rpx] bg-[url(https://tdesign.gtimg.com/miniprogram/template/retail/template/user-center-bg-v1.png)] bg-cover bg-no-repeat p-[0_24rpx] bg-[url('https://tdesign.gtimg.com/miniprogram/template/retail/template/user-center-bg-v1.png')]">
    <!-- 未登录的情况 -->
    <block v-if="currAuthStep === AuthStepType.ONE">
      <view class="user-center-card__header mt-[192rpx] mb-[48rpx] h-[96rpx] leading-[48rpx] flex justify-start items-center text-[#333] relative" @tap="gotoUserEditPage">
        <t-avatar :image="userInfo.avatarUrl || defaultAvatarUrl" class="user-center-card__header__avatar size-[96rpx] rounded-[48rpx] overflow-hidden" />
        <view class="user-center-card__header__name text-[36rpx] leading-[48rpx] text-[#333] [font-weight:bold] ml-[24rpx] mr-[16rpx]">
          {{ '请登录' }}
        </view>
      </view>
    </block>
    <!-- 已登录但未授权用户信息情况 -->
    <block v-if="currAuthStep === AuthStepType.TWO">
      <view class="user-center-card__header mt-[192rpx] mb-[48rpx] h-[96rpx] leading-[48rpx] flex justify-start items-center text-[#333] relative">
        <t-avatar :image="userInfo.avatarUrl || defaultAvatarUrl" class="user-center-card__header__avatar size-[96rpx] rounded-[48rpx] overflow-hidden" />
        <view class="user-center-card__header__name text-[36rpx] leading-[48rpx] text-[#333] [font-weight:bold] ml-[24rpx] mr-[16rpx]">
          {{ userInfo.nickName || '微信用户' }}
        </view>
        <!-- 需要授权用户信息，通过slot添加弹窗 -->
        <view v-if="isNeedGetUserInfo" class="user-center-card__header__transparent absolute left-0 top-0 bg-transparent size-full">
          <slot name="getUserInfo" />
        </view>
        <!-- 不需要授权用户信息，仍然触发gotoUserEditPage事件 -->
        <view v-else class="user-center-card__header__transparent absolute left-0 top-0 bg-transparent size-full" @tap="gotoUserEditPage" />
      </view>
    </block>
    <!-- 已登录且已经授权用户信息的情况 -->
    <block v-if="currAuthStep === AuthStepType.THREE">
      <view class="user-center-card__header mt-[192rpx] mb-[48rpx] h-[96rpx] leading-[48rpx] flex justify-start items-center text-[#333] relative" @tap="gotoUserEditPage">
        <t-avatar
          t-class="avatar"
          mode="aspectFill"
          class="user-center-card__header__avatar size-[96rpx] rounded-[48rpx] overflow-hidden"
          :image="userInfo.avatarUrl || defaultAvatarUrl"
        />
        <view class="user-center-card__header__name text-[36rpx] leading-[48rpx] text-[#333] [font-weight:bold] ml-[24rpx] mr-[16rpx]">
          {{ userInfo.nickName || '微信用户' }}
        </view>
      </view>
    </block>
  </view>
</template>
