<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import MapClassExample from '../../../components/issue-289/MapClassExample/index.vue'

const controlState = ref({
  calloutExpanded: true,
  showCalloutList: true,
  selectedIndex: 1,
})

function toggleCalloutExpanded() {
  controlState.value = {
    ...controlState.value,
    calloutExpanded: !controlState.value.calloutExpanded,
  }
}

function toggleShowCalloutList() {
  controlState.value = {
    ...controlState.value,
    showCalloutList: !controlState.value.showCalloutList,
  }
}

function cycleSelectedEvent() {
  controlState.value = {
    ...controlState.value,
    selectedIndex: (controlState.value.selectedIndex + 1) % 2,
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

function handleExpandedSwitchChange(event: any) {
  controlState.value = {
    ...controlState.value,
    calloutExpanded: normalizeSwitchValue(
      event?.detail?.value,
      controlState.value.calloutExpanded,
    ),
  }
}

function handleListSwitchChange(event: any) {
  controlState.value = {
    ...controlState.value,
    showCalloutList: normalizeSwitchValue(
      event?.detail?.value,
      controlState.value.showCalloutList,
    ),
  }
}

async function runE2E() {
  const before = {
    calloutExpanded: controlState.value.calloutExpanded,
    showCalloutList: controlState.value.showCalloutList,
    selectedIndex: controlState.value.selectedIndex,
  }

  toggleCalloutExpanded()
  toggleShowCalloutList()
  cycleSelectedEvent()
  await nextTick()

  const checks = {
    calloutExpandedChanged: controlState.value.calloutExpanded !== before.calloutExpanded,
    showCalloutListChanged: controlState.value.showCalloutList !== before.showCalloutList,
    selectedIndexChanged: controlState.value.selectedIndex !== before.selectedIndex,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      calloutExpanded: controlState.value.calloutExpanded,
      showCalloutList: controlState.value.showCalloutList,
      selectedIndex: controlState.value.selectedIndex,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="issue289-sub-page">
    <view class="issue289-sub-title">
      MapClassExample 场景
    </view>

    <view class="issue289-sub-toolbar">
      <view
        class="issue289-sub-btn issue289-map-toggle-expanded"
        :class="controlState.calloutExpanded ? 'issue289-ctrl-on' : 'issue289-ctrl-off'"
        @tap="toggleCalloutExpanded"
      >
        气泡尺寸：{{ controlState.calloutExpanded ? '展开' : '收起' }}
      </view>
      <view
        class="issue289-sub-btn issue289-map-toggle-list"
        :class="controlState.showCalloutList ? 'issue289-ctrl-on' : 'issue289-ctrl-off'"
        @tap="toggleShowCalloutList"
      >
        气泡列表：{{ controlState.showCalloutList ? '显示' : '隐藏' }}
      </view>
      <view
        class="issue289-sub-btn issue289-map-cycle-selected"
        :class="`issue289-cycle-${controlState.selectedIndex}`"
        @tap="cycleSelectedEvent"
      >
        选中事件：{{ controlState.selectedIndex }}
      </view>
    </view>

    <view class="issue289-switch-row">
      <view class="issue289-switch-item">
        <text class="issue289-switch-label">
          expanded
        </text>
        <switch
          class="issue289-map-switch-expanded"
          :checked="controlState.calloutExpanded"
          @change="handleExpandedSwitchChange"
        />
      </view>
      <view class="issue289-switch-item">
        <text class="issue289-switch-label">
          showList
        </text>
        <switch
          class="issue289-map-switch-list"
          :checked="controlState.showCalloutList"
          @change="handleListSwitchChange"
        />
      </view>
    </view>

    <MapClassExample
      :callout-expanded="controlState.calloutExpanded"
      :show-callout-list="controlState.showCalloutList"
      :selected-event-idx="controlState.selectedIndex"
      :mock-native-map="true"
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
</style>
