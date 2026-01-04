<script lang="ts">
import { storeToRefs } from 'wevu'
import { useCounterStore } from '../../shared'

export default {
  setup() {
    const counterStore = useCounterStore()
    const { count, doubleCount, displayName } = storeToRefs(counterStore)
    const { increment, decrement, reset } = counterStore

    function goDetail() {
      wx.navigateTo({ url: '/subpackages/normal-a/pages/detail/index?from=home' })
    }

    function goNormalB() {
      wx.navigateTo({ url: '/subpackages/normal-b/pages/home/index?from=normal-a' })
    }

    function goIndependentA() {
      wx.navigateTo({ url: '/subpackages/independent-a/pages/home/index?from=normal-a' })
    }

    function goToScenarioPage() {
      wx.navigateTo({ url: '/pages/subpackage-scenarios/index' })
    }

    return {
      count,
      doubleCount,
      displayName,
      increment,
      decrement,
      reset,
      goDetail,
      goNormalB,
      goIndependentA,
      goToScenarioPage,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      普通分包 A / Home
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
            double: {{ doubleCount }}
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small" @click="decrement">
            -
          </button>
          <button class="btn btn-small btn-primary" @click="increment">
            +
          </button>
        </view>
      </view>
      <view class="demo-row">
        <button class="btn btn-secondary" @click="reset">
          reset
        </button>
        <button class="btn btn-secondary" @click="goDetail">
          去 Detail
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        跨分包跳转
      </view>
      <view class="demo-row">
        <button class="btn btn-info" @click="goNormalB">
          去普通分包 B
        </button>
        <button class="btn btn-warning" @click="goIndependentA">
          去独立分包 A
        </button>
      </view>
      <view class="demo-row">
        <button class="btn btn-secondary" @click="goToScenarioPage">
          回到分包场景页
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

.buttons {
  display: flex;
  gap: 12rpx;
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
  "navigationBarTitleText": "普通分包 A"
}
</json>
