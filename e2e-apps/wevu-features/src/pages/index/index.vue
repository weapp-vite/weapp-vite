<script setup lang="ts">
const featureList = [
  {
    key: 'useAttrs',
    title: 'useAttrs',
    summary: '展示 setup 中 attrs 的响应式变化',
    path: '/pages/use-attrs/index',
  },
  {
    key: 'useSlots',
    title: 'useSlots',
    summary: '展示 setup 中 slots 的键集合与兜底语义',
    path: '/pages/use-slots/index',
  },
  {
    key: 'useModel',
    title: 'useModel',
    summary: '展示 setup 中 useModel 与 update:modelValue 事件',
    path: '/pages/use-model/index',
  },
  {
    key: 'provideInject',
    title: 'provide / inject',
    summary: '展示跨层共享状态与交互式响应更新',
    path: '/pages/use-provide-inject/index',
  },
  {
    key: 'store',
    title: 'store',
    summary: '展示 setup/options store 与 patch/reset/订阅能力',
    path: '/pages/use-store/index',
  },
  {
    key: 'native-uses-vue',
    title: 'native -> vue',
    summary: '展示原生组件通过 usingComponents 引入 Vue 组件',
    path: '/pages/native-uses-vue/index',
  },
] as const
</script>

<template>
  <view class="feature-nav-page">
    <view class="feature-nav-title">
      wevu 特性展示
    </view>
    <view class="feature-nav-subtitle">
      选择一个特性场景进入
    </view>

    <view class="feature-nav-list">
      <navigator
        v-for="item in featureList"
        :key="item.key"
        class="feature-nav-item"
        :url="item.path"
      >
        <view class="feature-nav-item-title">
          {{ item.title }}
        </view>
        <view class="feature-nav-item-summary">
          {{ item.summary }}
        </view>
      </navigator>
    </view>
  </view>
</template>

<style scoped>
.feature-nav-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.feature-nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
}

.feature-nav-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #475569;
}

.feature-nav-list {
  margin-top: 20rpx;
}

.feature-nav-item {
  display: block;
  padding: 22rpx;
  margin-top: 14rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 18rpx;
}

.feature-nav-item-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e293b;
}

.feature-nav-item-summary {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
}
</style>
