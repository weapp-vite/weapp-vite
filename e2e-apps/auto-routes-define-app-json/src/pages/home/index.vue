<script setup lang="ts">
interface RouteLink {
  route: string
  title: string
  kind: 'main' | 'subpackage'
  url: string
}

interface AppGlobalData {
  __autoRoutesPages?: string[]
  __autoRoutesEntries?: string[]
}

function formatTitle(route: string) {
  const normalized = route.replace(/\/index$/, '')
  const segments = normalized.split('/')
  const last = segments.length > 0 ? segments[segments.length - 1] : route
  if (!last) {
    return route
  }
  return last
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function routeToUrl(route: string) {
  if (route === 'pages/detail/index') {
    return `/${route}?id=42&from=home`
  }
  return `/${route}`
}

const app = getApp<{ globalData?: AppGlobalData }>()
const globalData = app && app.globalData ? app.globalData : {}
const entries = Array.isArray(globalData.__autoRoutesEntries) ? globalData.__autoRoutesEntries : []
const pages = Array.isArray(globalData.__autoRoutesPages) ? globalData.__autoRoutesPages : []

const pagesCount = pages.length
const routeLinks: RouteLink[] = entries.map((route) => {
  return {
    route,
    title: formatTitle(route),
    kind: route.startsWith('pages/') ? 'main' : 'subpackage',
    url: routeToUrl(route),
  }
})
</script>

<template>
  <view class="page-home">
    <view class="hero">
      <text class="title">
        auto-routes 导航中心
      </text>
      <text class="desc">
        链接来自 app.globalData 的 auto-routes 快照（主包 + 分包）
      </text>
      <text class="meta">
        主包页面：{{ pagesCount }}，总入口：{{ routeLinks.length }}
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        动态页面链接（含分包）
      </text>
      <view class="link-list">
        <navigator
          v-for="item in routeLinks"
          :key="item.route"
          :url="item.url"
          class="link-card"
          open-type="navigate"
        >
          <text class="link-title">
            {{ item.title }}
          </text>
          <text class="link-path">
            {{ item.route }}
          </text>
          <text class="link-kind">
            {{ item.kind }}
          </text>
        </navigator>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page-home {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
  background: #f2f7ff;
  border-radius: 16rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 600;
}

.desc,
.meta {
  font-size: 24rpx;
  color: #555;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.link-card {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 14rpx 16rpx;
  background: #fff;
  border: 1px solid #e8ecf3;
  border-radius: 12rpx;
}

.link-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #1a1a1a;
}

.link-path,
.link-kind {
  font-size: 22rpx;
  color: #5e6a7f;
}
</style>
