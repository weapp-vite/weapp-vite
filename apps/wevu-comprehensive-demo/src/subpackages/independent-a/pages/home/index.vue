<script lang="ts">
import { useIndependentACounter } from '../../state'

export default {
  setup() {
    const counter = useIndependentACounter()
    const { count, label, increment, reset } = counter

    function goDetail() {
      wx.navigateTo({ url: '/subpackages/independent-a/pages/detail/index?from=home' })
    }

    function goIndependentB() {
      wx.navigateTo({ url: '/subpackages/independent-b/pages/home/index?from=independent-a' })
    }

    function goNormalA() {
      wx.navigateTo({ url: '/subpackages/normal-a/pages/home/index?from=independent-a' })
    }

    function goToScenarioPage() {
      wx.navigateTo({ url: '/pages/subpackage-scenarios/index' })
    }

    return {
      count,
      label,
      increment,
      reset,
      goDetail,
      goIndependentB,
      goNormalA,
      goToScenarioPage,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      独立分包 A / Home
    </view>

    <view class="section">
      <view class="section-title">
        独立分包局部状态
      </view>
      <view class="demo-row">
        <view>
          <text class="label">
            {{ label }}
          </text>
          <view class="sub-text">
            count: {{ count }}
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small btn-primary" @click="increment">
            +1
          </button>
          <button class="btn btn-small btn-secondary" @click="reset">
            reset
          </button>
        </view>
      </view>
      <view class="demo-row">
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
        <button class="btn btn-warning" @click="goIndependentB">
          去独立分包 B
        </button>
        <button class="btn btn-info" @click="goNormalA">
          去普通分包 A
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
  "navigationBarTitleText": "独立分包 A"
}
</json>
