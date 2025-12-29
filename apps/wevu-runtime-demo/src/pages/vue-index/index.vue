<script setup lang="ts">
const sections = [
  { title: 'Vue 模板指令', desc: 'v-if / v-for / v-show / v-text / v-html 等', url: '/pages/vue-template/index' },
  { title: '属性与样式', desc: ':class / :style / v-bind 透传', url: '/pages/vue-bindings/index' },
  { title: '事件绑定', desc: '@click/@tap 与修饰符写法', url: '/pages/vue-events/index' },
  { title: 'v-model', desc: '表单 + 自定义组件 v-model:arg', url: '/pages/vue-v-model/index' },
  { title: '插槽进阶', desc: 'v-slot/# 动态插槽名', url: '/pages/vue-slots-advanced/index' },
  { title: '动态组件', desc: 'component :is / keep-alive / transition 等', url: '/pages/vue-dynamic/index' },
  { title: 'Script Setup', desc: 'defineProps/defineEmits/useAttrs 等', url: '/pages/vue-script-setup/index' },
  { title: 'Render 函数', desc: 'render() + h() 写法', url: '/pages/vue-render/index' },
  { title: '样式写法', desc: 'scoped + CSS modules', url: '/pages/vue-style/index' },
]

function open(url: string) {
  wx.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">
        Vue 写法覆盖（编译覆盖口径）
      </text>
      <text class="hero-desc">
        这些页面以 Vue 语法覆盖为主，运行语义不做强保证
      </text>
    </view>

    <view class="card">
      <view
        v-for="item in sections"
        :key="item.url"
        class="entry"
        @tap="() => open(item.url)"
      >
        <view class="entry-main">
          <text class="entry-title">
            {{ item.title }}
          </text>
          <text class="entry-desc">
            {{ item.desc }}
          </text>
        </view>
        <text class="entry-arrow">
          ›
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.hero {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #111827;
  color: #ffffff;
}

.hero-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  opacity: 0.8;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.entry {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 16rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.entry:last-child {
  border-bottom: 0;
}

.entry-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.entry-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.entry-desc {
  font-size: 24rpx;
  color: #6b7280;
}

.entry-arrow {
  font-size: 40rpx;
  color: #9ca3af;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "Vue 写法覆盖",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</config>
