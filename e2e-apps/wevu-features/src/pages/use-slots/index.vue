<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import UseSlotsFeature from '../../components/use-slots-feature/index.vue'

const controlState = ref({
  open: true,
  withHeader: true,
  count: 1,
})

function toggleOpen() {
  controlState.value.open = !controlState.value.open
}

function toggleHeader() {
  controlState.value.withHeader = !controlState.value.withHeader
}

function bumpCount() {
  controlState.value.count += 1
}

async function runE2E() {
  const before = {
    open: controlState.value.open,
    withHeader: controlState.value.withHeader,
    count: controlState.value.count,
  }

  toggleOpen()
  toggleHeader()
  bumpCount()
  await nextTick()

  const checks = {
    openChanged: controlState.value.open !== before.open,
    headerChanged: controlState.value.withHeader !== before.withHeader,
    countChanged: controlState.value.count !== before.count,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      open: controlState.value.open,
      withHeader: controlState.value.withHeader,
      count: controlState.value.count,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="use-slots-page">
    <view class="use-slots-page__title">
      wevu useSlots 特性展示
    </view>
    <view class="use-slots-page__subtitle">
      控制 slot 展示和内容，查看 slots 键与 class 变化
    </view>

    <view class="use-slots-page__toolbar">
      <view
        id="slots-ctrl-open"
        class="use-slots-page__btn"
        :class="controlState.open ? 'ctrl-on' : 'ctrl-off'"
        @tap="toggleOpen"
      >
        panel: {{ controlState.open ? 'open' : 'closed' }}
      </view>

      <view
        id="slots-ctrl-header"
        class="use-slots-page__btn"
        :class="controlState.withHeader ? 'ctrl-on' : 'ctrl-off'"
        @tap="toggleHeader"
      >
        header slot: {{ controlState.withHeader ? 'on' : 'off' }}
      </view>

      <view id="slots-ctrl-count" class="use-slots-page__btn" @tap="bumpCount">
        count: {{ controlState.count }}
      </view>
    </view>

    <view
      id="slots-open-state"
      class="use-slots-page__state"
      :class="controlState.open ? 'state-open' : 'state-closed'"
    >
      open state: {{ controlState.open ? 'open' : 'closed' }}
    </view>

    <UseSlotsFeature title="组件内 useSlots()" :open="controlState.open">
      <!-- eslint-disable-next-line vue/valid-v-slot -->
      <template #header>
        <view v-if="controlState.withHeader" class="use-slots-page__header">
          header slot content
        </view>
      </template>
      <view class="use-slots-page__body">
        default slot content {{ controlState.count }}
      </view>
    </UseSlotsFeature>
  </view>
</template>

<style scoped>
.use-slots-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f8fafc;
}

.use-slots-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.use-slots-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.use-slots-page__toolbar {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-slots-page__btn {
  margin: 6rpx;
  min-height: 58rpx;
  line-height: 58rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.use-slots-page__header {
  font-size: 22rpx;
  color: #0f766e;
}

.use-slots-page__body {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #334155;
}

.use-slots-page__state {
  margin-top: 12rpx;
  padding: 8rpx 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.state-open {
  color: #065f46;
  background: #d1fae5;
}

.state-closed {
  color: #7f1d1d;
  background: #fee2e2;
}

.ctrl-on {
  background: #bbf7d0;
}

.ctrl-off {
  background: #fecaca;
}
</style>
