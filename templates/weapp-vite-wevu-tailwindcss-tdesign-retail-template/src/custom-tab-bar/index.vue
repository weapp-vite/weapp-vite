<script setup lang="ts">
import { wpi } from 'wevu/api'
import TabMenu from './data'

interface TabChangeEvent {
  detail?: {
    value?: number | string
  }
  value?: number | string
  currentTarget?: {
    dataset?: {
      index?: number | string
      value?: number | string
    }
  }
  target?: {
    dataset?: {
      index?: number | string
      value?: number | string
    }
  }
}

defineOptions({
  data() {
    return {
      active: 0,
      list: TabMenu,
    }
  },
  methods: {
    async onChange(event: TabChangeEvent) {
      const value = event.detail?.value
        ?? event.value
        ?? event.currentTarget?.dataset?.value
        ?? event.currentTarget?.dataset?.index
        ?? event.target?.dataset?.value
        ?? event.target?.dataset?.index
      const active = Number(value)
      const item = this.data.list[active]

      if (!Number.isInteger(active) || !item) {
        return
      }

      this.setData({
        active,
      })
      await wpi.switchTab({
        url: item.url.startsWith('/') ? item.url : `/${item.url}`,
      })
    },
    init() {
      const page = getCurrentPages().pop()
      const route = page ? page.route.split('?')[0] : ''
      const active = this.data.list.findIndex(item => (item.url.startsWith('/') ? item.url.substr(1) : item.url) === `${route}`)
      this.setData({
        active: active === -1 ? 0 : active,
      })
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-tab-bar': 'tdesign-miniprogram/tab-bar/tab-bar',
    't-tab-bar-item': 'tdesign-miniprogram/tab-bar-item/tab-bar-item',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <t-tab-bar
    :value="active"
    :split="false"
    @change="onChange"
  >
    <t-tab-bar-item
      v-for="(item, index) in list"
      :key="index"
      :value="index"
    >
      <view class="custom-tab-bar-wrapper flex flex-col items-center [&_.text]:text-[20rpx]">
        <t-icon prefix="wr" :name="item.icon" size="48rpx" />
        <view class="text">
          {{ item.text }}
        </view>
      </view>
    </t-tab-bar-item>
  </t-tab-bar>
</template>
