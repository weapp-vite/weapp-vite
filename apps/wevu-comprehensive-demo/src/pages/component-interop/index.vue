<script lang="ts">
export default {
  data() {
    return {
      nativeWrappedCard: {
        title: '原生组件包装 Vue 组件',
        subtitle: '在原生 wxml 内直接引用 Vue 组件',
        badge: 'Mixed',
      },
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">Vue 与原生组件互操作</view>

    <view class="section">
      <view class="section-title">1. 页面直接引入 Vue 组件</view>
      <vue-card title="独立 Vue 组件" subtitle="无需额外封装即可使用" badge="Vue">
        <text class="note">
          页面 JSON 中通过 usingComponents 注册后，可直接在模板中引用 Vue SFC。
        </text>
      </vue-card>
    </view>

    <view class="section">
      <view class="section-title">2. Vue 组件内部使用原生组件</view>
      <vue-with-native />
      <view class="tip">
        <text class="tip-text">
          vue-with-native 组件内部通过 usingComponents 引入 native-badge（src/native/native-badge）。
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">3. 原生组件内部引入 Vue 组件</view>
      <native-uses-vue
        :title="nativeWrappedCard.title"
        :subtitle="nativeWrappedCard.subtitle"
        :badge="nativeWrappedCard.badge"
      />
      <view class="tip">
        <text class="tip-text">
          native-uses-vue 原生组件的 usingComponents 中指向 /components/vue-card/index，内部直接渲染 Vue
          组件。
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.note {
  display: block;
  margin-top: 12rpx;
  color: #4b5563;
  font-size: 26rpx;
  line-height: 1.6;
}

.tip {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #f3f4f6;
  border-radius: 12rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "组件互操作",
  "usingComponents": {
    "vue-card": "/components/vue-card/index",
    "vue-with-native": "/components/vue-with-native/index",
    "native-uses-vue": "/native/native-uses-vue/index"
  }
}
</config>
