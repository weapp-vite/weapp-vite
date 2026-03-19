<script setup lang="ts">
import { ref, setPageLayout } from 'wevu'
import { useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: '页面布局',
})

const router = useRouter()
const currentLayout = ref<'default' | 'admin' | 'none'>('default')

const cards = [
  {
    title: 'default 布局',
    desc: '当前页面默认命中 src/layouts/default.vue，适合作为轻量通用外壳。',
  },
  {
    title: 'admin 布局',
    desc: '点击按钮后会调用 setPageLayout(\'admin\') 切到命名布局，同时传入标题与说明。',
  },
  {
    title: '关闭布局',
    desc: '也可以通过 setPageLayout(false) 临时移除页面壳，让页面恢复为原始根结构。',
  },
]

function applyDefaultLayout() {
  currentLayout.value = 'default'
  setPageLayout('default')
}

function applyAdminLayout() {
  currentLayout.value = 'admin'
  setPageLayout('admin', {
    title: '业务后台布局',
    subtitle: '这个标题来自 setPageLayout() 传入的 props。',
  })
}

function clearLayout() {
  currentLayout.value = 'none'
  setPageLayout(false)
}

async function backHome() {
  await router.push('/pages/index/index')
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero__eyebrow">
        Layout Playground
      </view>
      <view class="hero__title">
        基础模板已接入 src/layouts 约定
      </view>
      <view class="hero__desc">
        当前状态：{{ currentLayout }}。可以在 default、admin 与 false 三种布局模式之间切换，作为正式业务页面的基础壳能力。
      </view>
    </view>

    <view
      v-for="item in cards"
      :key="item.title"
      class="section"
    >
      <view class="section__title">
        {{ item.title }}
      </view>
      <text class="section__desc">
        {{ item.desc }}
      </text>
    </view>

    <view class="section">
      <button class="action-btn" @tap="applyDefaultLayout">
        使用 default 布局
      </button>
      <button class="action-btn action-btn--primary" @tap="applyAdminLayout">
        切到 admin 布局
      </button>
      <button class="action-btn action-btn--ghost" @tap="clearLayout">
        关闭布局
      </button>
      <button class="action-btn action-btn--light" @tap="backHome">
        返回首页
      </button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx 28rpx 40rpx;
}

.hero,
.section {
  padding: 28rpx;
  margin-top: 20rpx;
  background: rgb(255 255 255 / 92%);
  border: 2rpx solid rgb(226 232 240 / 88%);
  border-radius: 28rpx;
  box-shadow: 0 12rpx 32rpx rgb(15 23 42 / 4%);
}

.hero {
  margin-top: 0;
  background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #bfdbfe;
}

.hero__eyebrow {
  font-size: 22rpx;
  font-weight: 600;
  color: #1d4ed8;
}

.hero__title {
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.hero__desc,
.section__desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #475569;
}

.section__title {
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.action-btn {
  margin-top: 16rpx;
  color: #fff;
  background: #0f172a;
  border-radius: 999rpx;
}

.action-btn--primary {
  background: #2563eb;
}

.action-btn--ghost {
  color: #0f172a;
  background: #e2e8f0;
}

.action-btn--light {
  color: #1d4ed8;
  background: #dbeafe;
}
</style>

<json>
{
  "navigationBarTitleText": "页面布局"
}
</json>
