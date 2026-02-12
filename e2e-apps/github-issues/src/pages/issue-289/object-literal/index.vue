<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import ObjectLiteralExample from '../../../components/issue-289/ObjectLiteralExample/index.vue'

const objectItemIds = ['item-0', 'item-1', 'item-2'] as const

const controlState = ref({
  showList: true,
  compactMode: false,
  activeIndex: 0,
})

const activeId = computed(() => objectItemIds[controlState.value.activeIndex] ?? objectItemIds[0])

function toggleShowList() {
  controlState.value.showList = !controlState.value.showList
}

function toggleCompactMode() {
  controlState.value.compactMode = !controlState.value.compactMode
}

function cycleActive() {
  controlState.value.activeIndex = (controlState.value.activeIndex + 1) % objectItemIds.length
}

async function runE2E() {
  const before = {
    compactMode: controlState.value.compactMode,
    activeIndex: controlState.value.activeIndex,
    showList: controlState.value.showList,
  }

  toggleShowList()
  await nextTick()
  const hiddenStep = controlState.value.showList === false

  toggleShowList()
  toggleCompactMode()
  cycleActive()
  await nextTick()

  const checks = {
    compactChanged: controlState.value.compactMode !== before.compactMode,
    activeChanged: controlState.value.activeIndex !== before.activeIndex,
    showListRoundTripWorked: hiddenStep && controlState.value.showList === before.showList,
    finalListVisible: controlState.value.showList === true,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      showList: controlState.value.showList,
      compactMode: controlState.value.compactMode,
      activeIndex: controlState.value.activeIndex,
      activeId: activeId.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="issue289-sub-page">
    <view class="issue289-sub-title">
      ObjectLiteralExample 场景
    </view>

    <view class="issue289-sub-toolbar">
      <view class="issue289-sub-btn issue289-object-toggle-list" @tap="toggleShowList">
        列表：{{ controlState.showList ? '显示' : '隐藏' }}
      </view>
      <view class="issue289-sub-btn issue289-object-toggle-compact" @tap="toggleCompactMode">
        密度：{{ controlState.compactMode ? '紧凑' : '宽松' }}
      </view>
      <view class="issue289-sub-btn issue289-object-cycle-active" @tap="cycleActive">
        激活项：{{ activeId }}
      </view>
    </view>

    <ObjectLiteralExample
      :show-list="controlState.showList"
      :compact-mode="controlState.compactMode"
      :active-id="activeId"
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
