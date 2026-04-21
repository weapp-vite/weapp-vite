<script setup lang="ts">
import { wpi } from 'wevu/api'

defineOptions({
  externalClasses: ['custom-class'],
  properties: {
    tabList: Array,
  },
  data() {
    return {
      unfolded: false,
      boardMaxHeight: null,
    }
  },
  attached(this: any) {
    wpi.createSelectorQuery().in(this).select('.c-tabbar-more').boundingClientRect((rect) => {
      this.setData({
        boardMaxHeight: rect.height,
      })
    }).exec()
  },
  methods: {
    changeFold(this: any) {
      this.setData({
        unfolded: !this.data.unfolded,
      })
      const {
        unfolded,
      } = this.data
      this.triggerEvent('change', {
        unfolded,
      })
    },
    onSelect(this: any, event: any) {
      const activeKey = event.currentTarget.dataset.index
      this.triggerEvent('select', activeKey)
      this.changeFold()
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {},
})
</script>

<template>
  <view class="c-tabbar-more w-full h-[calc(100%-var(--tabbar-height,100rpx))] absolute top-(--tabbar-height,100rpx)">
    <view class="c-tabbar-more__btn absolute top-[calc(0-var(--tabbar-height,100rpx))] right-0 w-[80rpx] h-(--tabbar-height,100rpx) leading-(--tabbar-height,100rpx) bg-(--tabbar-background-color,white) [box-shadow:-20rpx_0_20rpx_-10rpx_var(--tabbar-background-color,white)] text-center [&_.market]:text-[20rpx]" @tap="changeFold">
      <view :class="`wr ${unfolded ? 'wr-arrow-up' : 'wr-arrow-down'}`" />
    </view>
    <view v-if="unfolded" class="t-tabbar-more__boardwrapper absolute top-0 left-0 size-full">
      <view class="t-tabbar-more__mask size-full bg-[rgba(0,0,0,0.5)]" />
      <scroll-view
        class="c-tabbar-more__board absolute top-0 left-0 w-full max-h-full"
        scroll-y
      >
        <view class="c-tabbar-more__boardinner p-[20rpx_0_20rpx_20rpx] bg-(--tabbar-background-color,white) flex [flex-flow:row_wrap]">
          <view
            v-for="(item, index) in tabList"
            :key="index"
            class="c-tabbar-more__item text-overflow m-[0_20rpx_20rpx_0] flex-[0_0_calc((100%-60rpx)/3)] box-border p-[0_10rpx] rounded-[30rpx] h-[60rpx] leading-[60rpx] text-center text-[22rpx] text-[#5d5d5d] bg-[#eee] truncate"
            :data-index="index"
            @tap="onSelect"
          >
            {{ item.name }}
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>
