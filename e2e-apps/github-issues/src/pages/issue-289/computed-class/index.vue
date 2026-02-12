<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import ComputedClassExample from '../../../components/issue-289/ComputedClassExample/index.vue'

const controlState = ref({
  sourceEnabled: true,
  showItems: true,
  selectedIndex: 0,
})

function toggleSourceEnabled() {
  controlState.value = {
    ...controlState.value,
    sourceEnabled: !controlState.value.sourceEnabled,
  }
}

function toggleShowItems() {
  controlState.value = {
    ...controlState.value,
    showItems: !controlState.value.showItems,
  }
}

function cycleSelected() {
  controlState.value = {
    ...controlState.value,
    selectedIndex: (controlState.value.selectedIndex + 1) % 3,
  }
}

function normalizeSwitchValue(raw: unknown, fallback: boolean) {
  if (typeof raw === 'boolean') {
    return raw
  }
  if (typeof raw === 'number') {
    return raw !== 0
  }
  if (raw === 'true') {
    return true
  }
  if (raw === 'false') {
    return false
  }
  if (raw === '1' || raw === 'on') {
    return true
  }
  if (raw === '0' || raw === 'off') {
    return false
  }
  return !fallback
}

function handleSourceSwitchChange(event: any) {
  controlState.value = {
    ...controlState.value,
    sourceEnabled: normalizeSwitchValue(
      event?.detail?.value,
      controlState.value.sourceEnabled,
    ),
  }
}

function handleItemsSwitchChange(event: any) {
  controlState.value = {
    ...controlState.value,
    showItems: normalizeSwitchValue(
      event?.detail?.value,
      controlState.value.showItems,
    ),
  }
}

async function runE2E() {
  const before = {
    sourceEnabled: controlState.value.sourceEnabled,
    showItems: controlState.value.showItems,
    selectedIndex: controlState.value.selectedIndex,
  }

  toggleSourceEnabled()
  toggleShowItems()
  cycleSelected()
  await nextTick()

  const checks = {
    sourceChanged: controlState.value.sourceEnabled !== before.sourceEnabled,
    showItemsChanged: controlState.value.showItems !== before.showItems,
    selectedIndexChanged: controlState.value.selectedIndex !== before.selectedIndex,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      sourceEnabled: controlState.value.sourceEnabled,
      showItems: controlState.value.showItems,
      selectedIndex: controlState.value.selectedIndex,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="issue289-sub-page">
    <view class="issue289-sub-title">
      ComputedClassExample 场景
    </view>

    <view class="issue289-sub-toolbar">
      <view
        class="issue289-sub-btn issue289-computed-toggle-source"
        :class="controlState.sourceEnabled ? 'issue289-ctrl-on' : 'issue289-ctrl-off'"
        @tap="toggleSourceEnabled"
      >
        source：{{ controlState.sourceEnabled ? 'true' : 'false' }}
      </view>
      <view
        class="issue289-sub-btn issue289-computed-toggle-items"
        :class="controlState.showItems ? 'issue289-ctrl-on' : 'issue289-ctrl-off'"
        @tap="toggleShowItems"
      >
        列表：{{ controlState.showItems ? '显示' : '隐藏' }}
      </view>
      <view
        class="issue289-sub-btn issue289-computed-cycle-selected"
        :class="`issue289-cycle-${controlState.selectedIndex}`"
        @tap="cycleSelected"
      >
        选中项：{{ controlState.selectedIndex }}
      </view>
    </view>

    <view class="issue289-switch-row">
      <view class="issue289-switch-item">
        <text class="issue289-switch-label">
          source
        </text>
        <switch
          class="issue289-computed-switch-source"
          :checked="controlState.sourceEnabled"
          @change="handleSourceSwitchChange"
        />
      </view>
      <view class="issue289-switch-item">
        <text class="issue289-switch-label">
          showItems
        </text>
        <switch
          class="issue289-computed-switch-items"
          :checked="controlState.showItems"
          @change="handleItemsSwitchChange"
        />
      </view>
    </view>

    <ComputedClassExample
      :source-enabled="controlState.sourceEnabled"
      :show-items="controlState.showItems"
      :selected-index="controlState.selectedIndex"
    />
  </view>
</template>

<style scoped>
.issue289-sub-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.issue289-sub-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.issue289-sub-toolbar {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.issue289-sub-btn {
  margin: 6rpx;
  min-height: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  border: 0;
  font-size: 22rpx;
  color: #1f2937;
  background: #e2e8f0;
}

.issue289-switch-row {
  margin-top: 8rpx;
  display: flex;
  gap: 20rpx;
}

.issue289-switch-item {
  display: inline-flex;
  align-items: center;
}

.issue289-switch-label {
  margin-right: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue289-ctrl-on {
  border: 2rpx solid #22c55e;
}

.issue289-ctrl-off {
  border: 2rpx solid #ef4444;
}

.issue289-cycle-0 {
  border: 2rpx solid #0ea5e9;
}

.issue289-cycle-1 {
  border: 2rpx solid #f97316;
}

.issue289-cycle-2 {
  border: 2rpx solid #8b5cf6;
}
</style>
