<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'native-shell',
    props: {
      sidebar: true,
      title: 'Native Dashboard',
    },
  },
})

const notes = [
  '当前布局来自原生小程序组件，而不是 Vue SFC。',
  '页面内容仍然通过布局组件里的 <slot></slot> 节点插入。',
  '编译阶段只需要把页面包一层布局标签，并在 usingComponents 中注册该原生组件。',
]

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      原生布局示例
    </view>

    <view class="section">
      <view class="section-title">
        native-shell layout
      </view>
      <view v-for="note in notes" :key="note" class="note-row">
        <text class="note-row__bullet">
          •
        </text>
        <text class="note-row__text">
          {{ note }}
        </text>
      </view>
    </view>

    <view class="section status">
      <text class="status__title">
        当前能力链路
      </text>
      <text class="status__value">
        page -> native layout props -> slot
      </text>
    </view>

    <view class="section">
      <button class="btn btn-info" @tap="backToLayouts">
        返回布局总览
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.note-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 14rpx;
}

.note-row__bullet {
  color: #2563eb;
  font-size: 28rpx;
  line-height: 1.6;
}

.note-row__text {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.8;
  color: #334155;
}

.status {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.status__title {
  display: block;
  font-size: 24rpx;
  color: #475569;
}

.status__value {
  display: block;
  margin-top: 10rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #1d4ed8;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "原生布局示例"
}
</json>
