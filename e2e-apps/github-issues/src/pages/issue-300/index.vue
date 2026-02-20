<script setup lang="ts">
import { computed, ref } from 'wevu'
import PropsDestructureProbe from '../../components/issue-300/PropsDestructureProbe/index.vue'

const payload = ref({
  str: 'Hello',
  bool: true,
})

const boolLabel = computed(() => String(payload.value.bool))

function toggleBool() {
  payload.value = {
    ...payload.value,
    bool: !payload.value.bool,
  }
}

function _runE2E() {
  return {
    str: payload.value.str,
    bool: payload.value.bool,
    boolText: String(payload.value.bool),
    ok: payload.value.str === 'Hello' && typeof payload.value.bool === 'boolean',
  }
}
</script>

<template>
  <view class="issue300-page">
    <text class="issue300-title">
      issue-300 props destructure boolean binding
    </text>
    <text class="issue300-desc">
      验证 String(bool) 在 defineProps 解构场景下不再渲染为 undefined
    </text>

    <view class="issue300-toolbar">
      <view class="issue300-toggle" @tap="toggleBool">
        toggle bool: {{ boolLabel }}
      </view>
    </view>

    <PropsDestructureProbe
      :str="payload.str"
      :bool="payload.bool"
    />
  </view>
</template>

<style scoped>
.issue300-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue300-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue300-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue300-toolbar {
  margin-top: 14rpx;
}

.issue300-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 56rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 10rpx;
}
</style>
