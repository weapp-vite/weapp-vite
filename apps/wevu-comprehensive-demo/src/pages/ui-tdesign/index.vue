<script setup lang="ts">
import { computed, ref } from 'wevu'

import { tdesignComponentTags, toTDesignComponentName } from './components-list'

defineOptions({
  name: 'UiTDesignTab',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign 组件',
}))

const keyword = ref('')

const items = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return tdesignComponentTags
    .map((tag) => {
      const name = toTDesignComponentName(tag)
      return {
        tag,
        name,
        pagePath: `/pages/ui-tdesign/components/${name}/index`,
      }
    })
    .filter(item => !q || item.tag.includes(q) || item.name.includes(q))
})

function onSearchInput(event: any) {
  keyword.value = String(event?.detail?.value ?? event?.detail ?? '')
}

function open(item: { pagePath: string }) {
  wx.navigateTo({ url: item.pagePath })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      TDesign
    </view>

    <view class="section">
      <view class="section-title">
        组件列表（一个组件一个页面）
      </view>

      <t-search
        :value="keyword"
        placeholder="搜索组件，例如：button / dialog / tabs"
        @change="onSearchInput"
      />

      <view class="list">
        <view
          v-for="item in items"
          :key="item.tag"
          class="list-item"
          @click="open(item)"
        >
          <view class="list-title">
            {{ item.tag }}
          </view>
          <view class="list-subtitle">
            pages/ui-tdesign/components/{{ item.name }}/index
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.list-item {
  padding: 20rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
}

.list-item:active {
  opacity: 0.9;
}

.list-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.list-subtitle {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #64748b;
}
/* stylelint-enable order/properties-order */
</style>
