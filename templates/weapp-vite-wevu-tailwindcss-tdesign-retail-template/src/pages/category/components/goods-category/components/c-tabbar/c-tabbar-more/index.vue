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
  <view class="c-tabbar-more [width:100%] [height:calc(100%_-_var(--tabbar-height,_100rpx))] [position:absolute] [top:var(--tabbar-height,_100rpx)]">
    <view class="c-tabbar-more__btn [position:absolute] [top:calc(0rpx_-_var(--tabbar-height,_100rpx))] [right:0] [width:80rpx] [height:var(--tabbar-height,_100rpx)] [line-height:var(--tabbar-height,_100rpx)] [background-color:var(--tabbar-background-color,_white)] [box-shadow:-20rpx_0_20rpx_-10rpx_var(--tabbar-background-color,_white)] [text-align:center] [&_.market]:[font-size:20rpx]" @tap="changeFold">
      <view :class="`wr ${unfolded ? 'wr-arrow-up' : 'wr-arrow-down'}`" />
    </view>
    <view v-if="unfolded" class="t-tabbar-more__boardwrapper [position:absolute] [top:0] [left:0] [width:100%] [height:100%]">
      <view class="t-tabbar-more__mask [width:100%] [height:100%] [background-color:rgba(0,_0,_0,_0.5)]" />
      <scroll-view
        class="c-tabbar-more__board [position:absolute] [top:0] [left:0] [width:100%] [max-height:100%]"
        scroll-y
      >
        <view class="c-tabbar-more__boardinner [padding:20rpx_0_20rpx_20rpx] [background-color:var(--tabbar-background-color,_white)] [display:flex] [flex-flow:row_wrap]">
          <view
            v-for="(item, index) in tabList"
            :key="index"
            class="c-tabbar-more__item text-overflow [margin:0_20rpx_20rpx_0] [flex:0_0_calc((100%_-_60rpx)_/_3)] [box-sizing:border-box] [padding:0_10rpx] [border-radius:30rpx] [height:60rpx] [line-height:60rpx] [text-align:center] [font-size:22rpx] [color:#5d5d5d] [background-color:#eee] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap]"
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
