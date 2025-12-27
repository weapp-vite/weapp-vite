<script lang="ts">
export default {
  type: 'page',
  data() {
    return {
      slogan: '使用 TypeScript 编写页面配置',
      features: [
        '基于 satisfies 获得字段提示',
        '支持布尔/字符串等静态属性',
        'weapp-vite 内置 Vue 编译链自动生成 json',
      ],
    }
  },
}
</script>

<template>
  <view class="page">
    <text class="title">{{ slogan }}</text>
    <view class="features">
      <view wx:for="{{features}}" wx:key="index" class="feature">• {{ item }}</view>
    </view>
  </view>
</template>

<style>
.page {
  padding: 48rpx 32rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 24rpx;
}

.feature {
  font-size: 28rpx;
  margin-bottom: 12rpx;
}
</style>

<config lang="ts">
import type { Page } from '@weapp-core/schematics'

const config = {
  navigationBarTitleText: 'TS Config Demo',
  disableScroll: true,
  enablePullDownRefresh: true,
  backgroundColor: '#f5f7ff',
} satisfies Page

export default config
</config>
