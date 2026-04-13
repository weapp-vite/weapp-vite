---
title: 常用写法速查
description: 小程序 SFC 项目里最常见的业务场景写法，可以直接照着改。
keywords:
  - handbook
  - sfc
  - cookbook
  - 速查
---

# 常用写法速查

这一页不讲理论，就是一组"遇到这个需求，先这么写"的起手式。代码可以直接拿去改。

## 列表页

一个稳定的列表页至少要处理：loading、空状态、错误、下拉刷新、触底加载。

```vue
<script setup lang="ts">
import { computed, onLoad, onPullDownRefresh, onReachBottom, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '商品列表',
  enablePullDownRefresh: true,
}))

const list = ref<GoodsItem[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const hasMore = ref(true)
const isEmpty = computed(() => !loading.value && !error.value && list.value.length === 0)

async function loadList(pageNum: number) {
  if (loading.value) {
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await getGoodsList({ page: pageNum, size: 20 })
    if (pageNum === 1) {
      list.value = result.items
    }
    else {
      list.value = [...list.value, ...result.items]
    }
    hasMore.value = result.hasMore
    page.value = pageNum
  }
  catch {
    error.value = '加载失败，请重试'
  }
  finally {
    loading.value = false
  }
}

onLoad(() => loadList(1))

onPullDownRefresh(async () => {
  await loadList(1)
  wx.stopPullDownRefresh()
})

onReachBottom(() => {
  if (hasMore.value) {
    loadList(page.value + 1)
  }
})
</script>

<template>
  <view class="page">
    <view v-if="list.length" class="list">
      <view v-for="item in list" :key="item.id" class="item">
        <text>{{ item.title }}</text>
        <text class="price">¥{{ item.price }}</text>
      </view>
    </view>
    <view v-if="isEmpty" class="empty">
      暂无商品
    </view>
    <view v-if="error" class="error">
      <text>{{ error }}</text>
      <button size="mini" @tap="() => loadList(1)">
        重试
      </button>
    </view>
    <view v-if="loading" class="loading">
      加载中...
    </view>
    <view v-else-if="!hasMore && list.length" class="no-more">
      没有更多了
    </view>
  </view>
</template>
```

## 详情页

```vue
<script setup lang="ts">
import { onLoad, ref } from 'wevu'

definePageJson(() => ({ navigationBarTitleText: '商品详情' }))

const detail = ref<GoodsDetail | null>(null)
const loading = ref(true)
const error = ref('')

onLoad(async (query) => {
  if (!query.id) {
    error.value = '参数错误'
    loading.value = false
    return
  }
  try {
    detail.value = await getGoodsDetail(query.id)
  }
  catch {
    error.value = '加载失败'
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="page">
    <view v-if="loading">
      加载中...
    </view>
    <view v-else-if="error">
      {{ error }}
    </view>
    <view v-else-if="detail" class="detail">
      <image :src="detail.imageUrl" mode="aspectFill" class="cover" />
      <text class="title">{{ detail.title }}</text>
      <text class="price">¥{{ detail.price }}</text>
    </view>
  </view>
</template>
```

## 表单页

```vue
<script setup lang="ts">
import { ref } from 'wevu'

definePageJson(() => ({ navigationBarTitleText: '新建地址' }))

const form = ref({ name: '', phone: '', detail: '' })
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.name.trim()) {
    e.name = '请输入姓名'
  }
  if (!/^1\d{10}$/.test(form.value.phone)) {
    e.phone = '请输入正确手机号'
  }
  if (!form.value.detail.trim()) {
    e.detail = '请输入详细地址'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  if (!validate() || submitting.value) {
    return
  }
  submitting.value = true
  try {
    await saveAddress(form.value)
    wx.showToast({ title: '保存成功' })
    wx.navigateBack()
  }
  catch {
    wx.showToast({ title: '保存失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="form">
    <view class="field">
      <text class="label">姓名</text>
      <input v-model="form.name" placeholder="请输入姓名">
      <text v-if="errors.name" class="error">{{ errors.name }}</text>
    </view>
    <view class="field">
      <text class="label">手机号</text>
      <input v-model="form.phone" type="number" placeholder="请输入手机号">
      <text v-if="errors.phone" class="error">{{ errors.phone }}</text>
    </view>
    <view class="field">
      <text class="label">详细地址</text>
      <textarea v-model="form.detail" placeholder="请输入详细地址" />
      <text v-if="errors.detail" class="error">{{ errors.detail }}</text>
    </view>
    <button :disabled="submitting" @tap="submit">
      {{ submitting ? '保存中...' : '保存地址' }}
    </button>
  </view>
</template>
```

## 登录拦截

```ts
// utils/auth.ts
export function ensureLogin(targetPath?: string): boolean {
  const token = wx.getStorageSync('token')
  if (token) {
    return true
  }

  const currentPage = getCurrentPages().at(-1)
  const redirect = targetPath || (currentPage ? `/${currentPage.route}` : '/pages/home/index')
  wx.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(redirect)}` })
  return false
}
```

页面里用：

```ts
function onBuyTap() {
  if (!ensureLogin()) {
    return
  }
  wx.navigateTo({ url: '/pages/checkout/index' })
}
```

## 分享

```vue
<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from 'wevu'

onShareAppMessage(() => ({
  title: '推荐给你',
  path: `/pages/goods/index?id=${goodsId.value}`,
  imageUrl: goodsImage.value,
}))

onShareTimeline(() => ({
  title: '限时优惠',
  query: `id=${goodsId.value}`,
}))
</script>

<template>
  <button open-type="share">
    分享给好友
  </button>
</template>
```

注意：`onShareAppMessage` 需要用户点右上角菜单的"转发"或者页面里有 `open-type="share"` 的按钮才会触发。

## Tab 切换

```vue
<script setup lang="ts">
import { ref } from 'wevu'

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'shipped', label: '待收货' },
]
const activeTab = ref('all')

function onTabChange(key: string) {
  if (activeTab.value === key) {
    return
  }
  activeTab.value = key
  loadListByStatus(key)
}
</script>

<template>
  <view class="tabs">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab" :class="[{ active: activeTab === tab.key }]"
      @tap="() => onTabChange(tab.key)"
    >
      {{ tab.label }}
    </view>
  </view>
</template>
```

## Toast / Modal 封装

```ts
// utils/toast.ts
export function showSuccess(title: string) {
  wx.showToast({ title, icon: 'success' })
}

export function showError(title: string) {
  wx.showToast({ title, icon: 'none' })
}

export function confirm(content: string, title = '提示'): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: res => resolve(res.confirm),
      fail: () => resolve(false),
    })
  })
}
```

## 接下来

写页面的基本功到这里差不多了。接下来去理解一下 wevu 运行时到底在做什么：

- [Wevu 是什么，不是什么](/handbook/wevu/)
- [响应式和生命周期](/handbook/wevu/runtime)
