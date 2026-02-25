<script setup lang="ts">
import { computed, ref } from 'wevu'
import apiData from '../../data/miniprogram-api.json'
import { getCategoryMeta } from '../../data/miniprogram-categories'

definePageJson({
  navigationBarTitleText: '小程序 API 清单',
  backgroundColor: '#f7f8fc',
})

interface ApiEntry {
  name: string
  fullName: string
  categoryKey: string
  docUrl?: string | null
  source: string
}

const apis = (apiData.apis || []) as ApiEntry[]
const query = ref('')
const activeCategory = ref('all')
const expandedMap = ref<Record<string, boolean>>({})
const collapsedLimit = 18

function groupByCategory(items: ApiEntry[]) {
  const grouped: Record<string, ApiEntry[]> = {}
  items.forEach((item) => {
    if (!grouped[item.categoryKey]) {
      grouped[item.categoryKey] = []
    }
    grouped[item.categoryKey].push(item)
  })
  return grouped
}

const categoryTotals = computed(() => {
  const grouped = groupByCategory(apis)
  const totals: Record<string, number> = {}
  Object.keys(grouped).forEach((key) => {
    totals[key] = grouped[key].length
  })
  return totals
})

const filterList = computed(() => {
  const keys = Object.keys(categoryTotals.value)
  keys.sort((a, b) => getCategoryMeta(a).order - getCategoryMeta(b).order)
  const filters = [
    { key: 'all', title: '全部', count: apis.length },
  ]
  keys.forEach((key) => {
    const meta = getCategoryMeta(key)
    filters.push({
      key,
      title: meta.title,
      count: categoryTotals.value[key] || 0,
    })
  })
  return filters
})

interface CategoryItem {
  key: string
  title: string
  description: string
  order: number
  demoPath?: string
  total: number
  apis: ApiEntry[]
  hiddenCount: number
  expanded: boolean
}

const categoryList = computed(() => {
  const grouped = groupByCategory(apis)
  const queryText = query.value.trim().toLowerCase()
  const keys = Object.keys(grouped)
  keys.sort((a, b) => getCategoryMeta(a).order - getCategoryMeta(b).order)
  const categories: CategoryItem[] = []

  keys.forEach((key) => {
    const meta = getCategoryMeta(key)
    let list = grouped[key] || []
    if (queryText) {
      list = list.filter((item) => {
        const target = `${item.fullName} ${item.docUrl || ''}`.toLowerCase()
        return target.includes(queryText)
      })
    }
    if (activeCategory.value !== 'all' && activeCategory.value !== key) {
      return
    }
    if (!list.length) {
      return
    }

    const sorted = list.slice().sort((a, b) => {
      return a.fullName.localeCompare(b.fullName)
    })
    const expanded = !!expandedMap.value[key]
    const displayApis = expanded
      ? sorted
      : sorted.slice(0, collapsedLimit)
    const hiddenCount = sorted.length - displayApis.length

    categories.push({
      key,
      title: meta.title,
      description: meta.description,
      order: meta.order,
      demoPath: meta.demoPath,
      total: sorted.length,
      apis: displayApis,
      hiddenCount,
      expanded,
    })
  })

  return categories
})

function selectCategory(key = 'all') {
  activeCategory.value = key
}

function toggleExpand(key?: string) {
  if (!key) {
    return
  }
  expandedMap.value = {
    ...expandedMap.value,
    [key]: !expandedMap.value[key],
  }
}

function jump(url?: string) {
  if (url) {
    wx.navigateTo({ url })
  }
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        微信小程序 API 全量清单
      </text>
      <text class="subtitle">
        基于 miniprogram-api-typings 自动生成，按官方分类归档。
      </text>
    </view>

    <view class="toolbar">
      <input
        v-model="query"
        class="search"
        placeholder="搜索 API / 文档链接"
      >
    </view>

    <scroll-view class="filters" scroll-x="true" show-scrollbar="false">
      <view class="filter-track">
        <view
          v-for="filter in filterList"
          :key="filter.key"
          class="filter" :class="[{ active: filter.key === activeCategory }]"
          @tap="selectCategory(filter.key)"
        >
          <text class="filter-title">
            {{ filter.title }}
          </text>
          <text class="filter-count">
            {{ filter.count }}
          </text>
        </view>
      </view>
    </scroll-view>

    <view class="nav-cards">
      <view class="nav-card">
        <text class="nav-title">
          Wevu 快速示例
        </text>
        <text class="nav-desc">
          基础响应式与模板示例
        </text>
        <button class="nav-btn" @tap="jump('/pages/wevu/index')">
          进入示例
        </button>
        <button class="nav-btn light" @tap="jump('/pages/vue-compat/index')">
          Vue 兼容性对照
        </button>
      </view>
      <view class="nav-card">
        <text class="nav-title">
          配置示例
        </text>
        <text class="nav-desc">
          TS/JS 配置写法对照
        </text>
        <button class="nav-btn light" @tap="jump('/pages/config-ts/index')">
          TS 配置
        </button>
        <button class="nav-btn light" @tap="jump('/pages/config-js/index')">
          JS 配置
        </button>
      </view>
    </view>

    <view class="section-title">
      <text>分类清单</text>
    </view>

    <view v-for="category in categoryList" :key="category.key" class="category">
      <view class="category-head">
        <view>
          <text class="category-title">
            {{ category.title }}
          </text>
          <text class="category-desc">
            {{ category.description }}
          </text>
        </view>
        <text class="category-count">
          {{ category.total }} APIs
        </text>
      </view>

      <view class="category-actions">
        <button
          v-if="category.demoPath"
          class="demo-btn"
          @tap="jump(category.demoPath)"
        >
          进入 Demo
        </button>
        <text v-else class="demo-empty">
          暂无 Demo
        </text>
        <button
          class="toggle-btn"
          @tap="toggleExpand(category.key)"
        >
          {{ category.expanded ? '收起' : '展开' }}
        </button>
      </view>

      <view class="api-list">
        <view v-for="api in category.apis" :key="api.fullName" class="api-item">
          <text class="api-name">
            {{ api.fullName }}
          </text>
          <text class="api-source">
            {{ api.source }}
          </text>
        </view>
      </view>

      <view v-if="!category.expanded && category.hiddenCount > 0" class="api-more">
        还有 {{ category.hiddenCount }} 个 API，点击展开查看完整列表
      </view>
    </view>
  </view>
</template>

<style>
.page {
  min-height: 100vh;
  padding: 40rpx 28rpx 80rpx;
  color: #1b1c2b;
  background: #f7f8fc;
}

.hero {
  padding: 32rpx;
  margin-bottom: 28rpx;
  background: linear-gradient(135deg, #eef1ff, #fff);
  border-radius: 24rpx;
  box-shadow: 0 16rpx 40rpx rgb(30 37 89 / 8%);
}

.title {
  font-size: 40rpx;
  font-weight: 700;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #5a5f7a;
}

.toolbar {
  margin-bottom: 16rpx;
}

.search {
  height: 88rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 20rpx rgb(30 37 89 / 8%);
}

.filters {
  margin-bottom: 24rpx;
}

.filter-track {
  display: flex;
  gap: 16rpx;
}

.filter {
  display: flex;
  gap: 8rpx;
  align-items: center;
  padding: 16rpx 22rpx;
  font-size: 24rpx;
  color: #4a4f6a;
  background: #fff;
  border: 2rpx solid #e5e7f2;
  border-radius: 999rpx;
}

.filter.active {
  color: #fff;
  background: #1c2a5b;
  border-color: #1c2a5b;
}

.filter-count {
  padding: 4rpx 10rpx;
  font-size: 22rpx;
  background: rgb(255 255 255 / 20%);
  border-radius: 999rpx;
}

.nav-cards {
  display: grid;
  gap: 20rpx;
  margin-bottom: 32rpx;
}

.nav-card {
  padding: 24rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 12rpx 28rpx rgb(30 37 89 / 8%);
}

.nav-title {
  font-size: 30rpx;
  font-weight: 600;
}

.nav-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b728c;
}

.nav-btn {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #fff;
  background: #273277;
  border-radius: 16rpx;
}

.nav-btn.light {
  color: #1c2a5b;
  background: #f2f4ff;
}

.section-title {
  margin: 24rpx 0 16rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.category {
  padding: 24rpx;
  margin-bottom: 24rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 24rpx rgb(30 37 89 / 6%);
}

.category-head {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
}

.category-title {
  font-size: 28rpx;
  font-weight: 600;
}

.category-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6b728c;
}

.category-count {
  font-size: 22rpx;
  color: #9aa0b7;
}

.category-actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 16rpx;
}

.demo-btn {
  font-size: 24rpx;
  color: #1b1c2b;
  background: #f3b34c;
  border-radius: 14rpx;
}

.demo-empty {
  font-size: 24rpx;
  color: #9aa0b7;
}

.toggle-btn {
  font-size: 24rpx;
  color: #1c2a5b;
  background: #eef1ff;
  border-radius: 14rpx;
}

.api-list {
  display: grid;
  gap: 10rpx;
  margin-top: 16rpx;
}

.api-item {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  font-size: 22rpx;
  background: #f6f7fb;
  border-radius: 14rpx;
}

.api-name {
  color: #1c2a5b;
}

.api-source {
  color: #8a90a8;
}

.api-more {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #8a90a8;
}
</style>
