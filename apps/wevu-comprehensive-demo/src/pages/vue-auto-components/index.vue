<script setup lang="ts">
import { computed, ref } from 'wevu'

import { VueCard } from '../../components'
import NativeBadge from '../../native/native-badge/index'

const badgeTypes = ['info', 'success', 'warning'] as const
const badgeIndex = ref(0)
const badgeType = computed(() => badgeTypes[badgeIndex.value])

function nextBadgeType() {
  badgeIndex.value = (badgeIndex.value + 1) % badgeTypes.length
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Script Setup 自动 usingComponents
    </view>

    <view class="section">
      <view class="section-title">
        说明
      </view>
      <view class="card">
        <text class="muted">
          本页在 &lt;script setup&gt; 中直接 import 组件并在模板中使用（PascalCase 标签）。
        </text>
        <text class="muted">
          无需在 &lt;config&gt; 中写 usingComponents，编译时会自动生成并剔除仅用于模板的 import。
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        1) 引入 Vue SFC 组件
      </view>
      <VueCard title="VueCard（script setup import）" subtitle="无需手写 usingComponents" badge="Auto">
        <text class="muted">
          VueCard 来自 src/components/vue-card/index.vue
        </text>
      </VueCard>
    </view>

    <view class="section">
      <view class="section-title">
        2) 引入原生自定义组件
      </view>
      <view class="row">
        <NativeBadge :text="`状态：${badgeType}`" :type="badgeType" />
        <button class="btn btn-info" size="mini" @click="nextBadgeType">
          切换
        </button>
      </view>
      <view class="tip">
        <text class="tip-text">
          NativeBadge 来自 src/native/native-badge（原生组件）。
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.card {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.muted {
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.6;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
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

<json>
{
  "navigationBarTitleText": "自动 usingComponents"
}
</json>
