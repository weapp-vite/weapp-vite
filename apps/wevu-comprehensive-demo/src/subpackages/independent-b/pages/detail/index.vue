<script lang="ts">
import { useIndependentBCounter } from '../../state'

export default {
  setup() {
    const counter = useIndependentBCounter()
    const { count, label, increment } = counter

    function back() {
      wx.navigateBack()
    }

    function goToScenarioPage() {
      wx.navigateTo({ url: '/pages/subpackage-scenarios/index' })
    }

    return {
      count,
      label,
      increment,
      back,
      goToScenarioPage,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      独立分包 B / Detail
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
        <button class="btn btn-small btn-primary" @click="increment">
          +1
        </button>
      </view>
      <view class="demo-row">
        <button class="btn btn-secondary" @click="back">
          返回
        </button>
        <button class="btn btn-secondary" @click="goToScenarioPage">
          分包场景页
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
  "navigationBarTitleText": "独立分包 B / Detail"
}
</json>
