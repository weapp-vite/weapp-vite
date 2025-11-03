<script>
export default {
  type: 'page',
  data() {
    return {
      slogan: '使用 JavaScript 编写页面配置',
      links: [
        { text: '查看 TS 版本', url: '/pages/config-ts/index' },
        { text: '返回主示例', url: '/pages/wevu/index' },
      ],
    }
  },
  methods: {
    jump(event) {
      const url = event?.currentTarget?.dataset?.url
      if (url) {
        wx.navigateTo({ url })
      }
    },
  },
}
</script>

<template>
  <view class="page">
    <text class="title">{{ slogan }}</text>
    <view class="links">
      <button
        wx:for="{{links}}"
        wx:key="url"
        bindtap="jump"
        data-url="{{ item.url }}"
      >
        {{ item.text }}
      </button>
    </view>
  </view>
</template>

<style>
.page {
  padding: 48rpx 32rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 24rpx;
}

.links button {
  margin-bottom: 16rpx;
}
</style>

<config lang="js">
const config = {
  navigationBarTitleText: 'JS Config Demo',
  disableScroll: false,
  backgroundColor: '#ffffff',
}

export default config
</config>
