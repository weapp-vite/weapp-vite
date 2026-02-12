<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import RootClassExample from '../../../components/issue-289/RootClassExample/index.vue'

const rootOptionIds = ['root-a', 'root-b', 'root-c'] as const

const controlState = ref({
  showOptions: true,
  selectedIndex: 0,
})

const selectedOptionId = computed(() => rootOptionIds[controlState.value.selectedIndex] ?? rootOptionIds[0])

function toggleShowOptions() {
  controlState.value.showOptions = !controlState.value.showOptions
}

function cycleOption() {
  controlState.value.selectedIndex = (controlState.value.selectedIndex + 1) % rootOptionIds.length
}

async function runE2E() {
  const before = {
    showOptions: controlState.value.showOptions,
    selectedIndex: controlState.value.selectedIndex,
  }

  cycleOption()
  toggleShowOptions()
  await nextTick()

  const checks = {
    selectedIndexChanged: controlState.value.selectedIndex !== before.selectedIndex,
    showOptionsChanged: controlState.value.showOptions !== before.showOptions,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      showOptions: controlState.value.showOptions,
      selectedIndex: controlState.value.selectedIndex,
      selectedOptionId: selectedOptionId.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="issue289-sub-page">
    <view class="issue289-sub-title">
      RootClassExample 场景
    </view>

    <view class="issue289-sub-toolbar">
      <view class="issue289-sub-btn issue289-root-toggle-options" @tap="toggleShowOptions">
        选项：{{ controlState.showOptions ? '显示' : '隐藏' }}
      </view>
      <view class="issue289-sub-btn issue289-root-cycle-option" @tap="cycleOption">
        选中类：{{ selectedOptionId }}
      </view>
    </view>

    <RootClassExample
      :show-options="controlState.showOptions"
      :selected-option-id="selectedOptionId"
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
  line-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
  color: #1f2937;
  background: #e2e8f0;
}
</style>
