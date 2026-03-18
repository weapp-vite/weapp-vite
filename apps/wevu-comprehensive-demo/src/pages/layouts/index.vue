<script setup lang="ts">
const demos = [
  {
    title: '默认布局',
    desc: '不声明 definePageMeta，自动命中 layouts/default.vue。',
    path: '/pages/layouts/default-demo/index',
    badge: 'default',
  },
  {
    title: 'Admin 布局',
    desc: '通过 definePageMeta({ layout: \'admin\' }) 切换到命名布局。',
    path: '/pages/layouts/admin-demo/index',
    badge: 'vue',
  },
  {
    title: '原生布局',
    desc: '通过 definePageMeta({ layout: \'native-shell\' }) 使用原生组件布局。',
    path: '/pages/layouts/native-demo/index',
    badge: 'native',
  },
  {
    title: '关闭布局',
    desc: '通过 definePageMeta({ layout: false }) 禁用默认布局。',
    path: '/pages/layouts/no-layout-demo/index',
    badge: 'false',
  },
  {
    title: 'Route Rules',
    desc: '不写 definePageMeta，由 vite.config.ts 中的 weapp.routeRules 指定默认布局。',
    path: '/pages/layouts/route-rules-demo/index',
    badge: 'config',
  },
  {
    title: 'setPageLayout',
    desc: '通过显式 API 在运行时切换 admin/native-shell/false 三种 layout。',
    path: '/pages/layouts/set-page-layout-demo/index',
    badge: 'api',
  },
]

function openDemo(path: string) {
  wx.navigateTo({ url: path })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      页面布局 Layouts
    </view>

    <view class="section intro">
      <view class="section-title">
        Nuxt 风格的页面布局
      </view>
      <text class="intro__text">
        这个示例 app 已接入 `src/layouts` 目录约定。页面内容会被包裹进布局组件，并通过布局中的
        `<slot></slot>` 渲染。
      </text>
      <view class="intro__codes">
        <text class="intro__code">
          layouts/default.vue
        </text>
        <text class="intro__code">
          layouts/admin.vue
        </text>
        <text class="intro__code">
          layouts/native-shell/index.wxml
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        试试这四种布局路径
      </view>
      <view v-for="demo in demos" :key="demo.path" class="demo-card" @tap="openDemo(demo.path)">
        <view class="demo-card__head">
          <text class="demo-card__title">
            {{ demo.title }}
          </text>
          <text class="demo-card__badge">
            {{ demo.badge }}
          </text>
        </view>
        <text class="demo-card__desc">
          {{ demo.desc }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.intro__text {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #475569;
}

.intro__codes {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.intro__code {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #0f172a;
  background: #e2e8f0;
}

.demo-card {
  padding: 24rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
  border: 1rpx solid #e2e8f0;
  margin-top: 16rpx;
}

.demo-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-card__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #0f172a;
}

.demo-card__badge {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 20rpx;
  text-transform: uppercase;
}

.demo-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.7;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "页面布局"
}
</json>
