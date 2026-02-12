<script setup lang="ts">
const sceneLinks = [
  {
    name: 'ObjectLiteralExample 场景',
    desc: '对象字面量 + v-if/v-for + class 受控',
    url: '/pages/issue-289/object-literal/index',
  },
  {
    name: 'MapClassExample 场景',
    desc: '地图 slot + v-if/v-for + class 受控',
    url: '/pages/issue-289/map-class/index',
  },
  {
    name: 'RootClassExample 场景',
    desc: 'root class + v-if/v-for + class 受控',
    url: '/pages/issue-289/root-class/index',
  },
  {
    name: 'ComputedClassExample 场景',
    desc: 'computed class + v-if/v-for + class 受控',
    url: '/pages/issue-289/computed-class/index',
  },
]
</script>

<template>
  <view class="issue289-nav-page">
    <view class="issue289-nav-title">
      issue-289 场景导航
    </view>
    <view class="issue289-nav-desc">
      每个组件都拆分到独立页面并带独立控制区，方便逐项验证。
    </view>

    <navigator
      v-for="item in sceneLinks"
      :key="item.url"
      class="issue289-nav-item"
      :url="item.url"
      hover-class="issue289-nav-item-hover"
    >
      <view class="issue289-nav-item-title">
        {{ item.name }}
      </view>
      <view class="issue289-nav-item-desc">
        {{ item.desc }}
      </view>
    </navigator>
  </view>
</template>

<style scoped>
.issue289-nav-page {
  min-height: 100vh;
  padding: 28rpx;
  box-sizing: border-box;
  background: #f8fafc;
}

.issue289-nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue289-nav-desc {
  margin-top: 10rpx;
  margin-bottom: 18rpx;
  font-size: 24rpx;
  color: #475569;
}

.issue289-nav-item {
  display: block;
  margin-bottom: 12rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  border: 2rpx solid #dbeafe;
  background: #ffffff;
}

.issue289-nav-item-hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.issue289-nav-item-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.issue289-nav-item-desc {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #475569;
}
</style>
