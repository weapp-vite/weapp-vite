<script setup lang="ts">
import { computed } from 'wevu'

import { buildTimeSubtitle } from '../../pages/json-macros/macro.config'

defineComponentJson(() => ({
  styleIsolation: 'isolated',
  options: {
    virtualHost: true,
  },
  externalClasses: ['macro-card-class'],
}))

const subtitle = computed(() => buildTimeSubtitle())
</script>

<template>
  <view class="card">
    <view class="title">
      defineComponentJson（build-time）
    </view>
    <view class="desc">
      <text class="muted">
        {{ subtitle }}
      </text>
    </view>
    <view class="desc">
      <text class="muted">
        Check emitted: dist/components/json-macro-card/index.json
      </text>
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

.title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.desc {
  font-size: 22rpx;
  line-height: 1.6;
}

.muted {
  color: #64748b;
}
/* stylelint-enable order/properties-order */
</style>
