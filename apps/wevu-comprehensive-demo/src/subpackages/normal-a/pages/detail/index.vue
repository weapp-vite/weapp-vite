<script lang="ts">
import { storeToRefs } from 'wevu'
import { useCounterStore } from '../../shared'

export default {
  setup() {
    const counterStore = useCounterStore()
    const { count, doubleCount, displayName } = storeToRefs(counterStore)
    const { increment } = counterStore

    function back() {
      wx.navigateBack()
    }

    function goNormalBDetail() {
      wx.navigateTo({ url: '/subpackages/normal-b/pages/detail/index?from=normal-a-detail' })
    }

    return {
      count,
      doubleCount,
      displayName,
      increment,
      back,
      goNormalBDetail,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      普通分包 A / Detail
    </view>

    <view class="section">
      <view class="section-title">
        共享 counter store（主包）
      </view>
      <view class="demo-row">
        <view>
          <text class="label">
            {{ displayName }}
          </text>
          <view class="sub-text">
            count: {{ count }}, double: {{ doubleCount }}
          </view>
        </view>
        <button class="btn btn-small btn-primary" @click="increment">
          +1
        </button>
      </view>
      <view class="demo-row">
        <button class="btn btn-secondary" @click="back">
          返回
        </button>
        <button class="btn btn-info" @click="goNormalBDetail">
          去普通分包 B / Detail
        </button>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.label {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.sub-text {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.demo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}

.btn-small {
  padding: 16rpx 20rpx;
  font-size: 24rpx;
}

.btn-secondary {
  background: #f1f5f9;
  color: #0f172a;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "普通分包 A / Detail"
}
</json>
