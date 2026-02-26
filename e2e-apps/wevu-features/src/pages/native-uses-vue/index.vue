<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import NativeUsesVue from '../../native/native-uses-vue/index'

definePageJson({
  navigationBarTitleText: 'native -> vue',
})

const modeList = ['basic', 'contrast'] as const
const modeIndex = ref(0)
const count = ref(1)

const currentMode = computed(() => modeList[modeIndex.value] ?? modeList[0])

function toggleMode() {
  modeIndex.value = (modeIndex.value + 1) % modeList.length
}

function increaseCount() {
  count.value += 1
}

async function runE2E() {
  const before = {
    mode: currentMode.value,
    count: count.value,
  }

  toggleMode()
  increaseCount()
  await nextTick()

  const checks = {
    modeChanged: currentMode.value !== before.mode,
    countChanged: count.value !== before.count,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      mode: currentMode.value,
      count: count.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="native-interop-page">
    <view class="native-interop-page__title">
      原生组件引入 Vue 组件
    </view>
    <view class="native-interop-page__subtitle">
      验证 native usingComponents -> Vue SFC 链路
    </view>

    <view class="native-interop-page__toolbar">
      <view id="native-interop-toggle" class="native-interop-page__btn" @tap="toggleMode">
        mode: {{ currentMode }}
      </view>
      <view id="native-interop-count" class="native-interop-page__btn" @tap="increaseCount">
        count: {{ count }}
      </view>
    </view>

    <NativeUsesVue
      title="原生组件引入 Vue 组件（static）"
      subtitle="native -> vue static chain"
      badge="static"
      note="这段文本由原生组件传递给 Vue 组件。"
    />
  </view>
</template>

<style scoped>
.native-interop-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.native-interop-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.native-interop-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.native-interop-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.native-interop-page__btn {
  min-height: 58rpx;
  padding: 0 16rpx;
  margin: 6rpx;
  font-size: 22rpx;
  line-height: 58rpx;
  color: #1f2937;
  background: #e2e8f0;
  border-radius: 9999rpx;
}
</style>
