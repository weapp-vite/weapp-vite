<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import UseAttrsFeature from '../../components/use-attrs-feature/index.vue'

const toneClassList = ['tone-blue', 'tone-green', 'tone-orange'] as const

const controlState = ref({
  toneIndex: 0,
  visible: true,
  strongBorder: false,
  seed: 1,
})

const currentToneClass = computed(() => toneClassList[controlState.value.toneIndex] ?? toneClassList[0])
const currentBadgeStyle = computed(() => {
  if (controlState.value.strongBorder) {
    return 'border: 2rpx solid #0f172a; padding: 8rpx 16rpx;'
  }
  return 'border: 2rpx dashed #64748b; padding: 8rpx 16rpx;'
})
const currentExtraLabel = computed(() => `seed-${controlState.value.seed}`)

function cycleToneClass() {
  controlState.value.toneIndex = (controlState.value.toneIndex + 1) % toneClassList.length
}

function toggleVisible() {
  controlState.value.visible = !controlState.value.visible
}

function toggleStrongBorder() {
  controlState.value.strongBorder = !controlState.value.strongBorder
}

function bumpSeed() {
  controlState.value.seed += 1
}

async function runE2E() {
  const before = {
    toneIndex: controlState.value.toneIndex,
    visible: controlState.value.visible,
    strongBorder: controlState.value.strongBorder,
    seed: controlState.value.seed,
  }

  cycleToneClass()
  toggleVisible()
  toggleStrongBorder()
  bumpSeed()
  await nextTick()

  const checks = {
    toneChanged: controlState.value.toneIndex !== before.toneIndex,
    visibleChanged: controlState.value.visible !== before.visible,
    borderChanged: controlState.value.strongBorder !== before.strongBorder,
    seedChanged: controlState.value.seed !== before.seed,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      toneIndex: controlState.value.toneIndex,
      visible: controlState.value.visible,
      strongBorder: controlState.value.strongBorder,
      seed: controlState.value.seed,
      toneClass: currentToneClass.value,
      badgeStyle: currentBadgeStyle.value,
      extraLabel: currentExtraLabel.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="use-attrs-page">
    <view class="use-attrs-page__title">
      wevu useAttrs 特性展示
    </view>
    <view class="use-attrs-page__subtitle">
      下面按钮控制的是组件的非 props 参数（attrs）
    </view>

    <view class="use-attrs-page__toolbar">
      <view
        id="ctrl-cycle-tone"
        class="use-attrs-page__btn wevu-features-btn-cycle-tone"
        :class="[currentToneClass]"
        @tap="cycleToneClass"
      >
        切换 tone：{{ currentToneClass }}
      </view>
      <view
        id="ctrl-toggle-visible"
        class="use-attrs-page__btn wevu-features-btn-toggle-visible"
        :class="[
          controlState.visible ? 'ctrl-on' : 'ctrl-off',
        ]"
        @tap="toggleVisible"
      >
        切换 visible：{{ controlState.visible ? 'true' : 'false' }}
      </view>
      <view
        id="ctrl-toggle-border"
        class="use-attrs-page__btn wevu-features-btn-toggle-border"
        :class="[
          controlState.strongBorder ? 'ctrl-solid' : 'ctrl-dash',
        ]"
        :style="currentBadgeStyle"
        @tap="toggleStrongBorder"
      >
        边框模式：{{ controlState.strongBorder ? 'strong' : 'dash' }}
      </view>
      <view id="ctrl-bump-seed" class="use-attrs-page__btn wevu-features-btn-bump-seed" @tap="bumpSeed">
        递增 seed：{{ controlState.seed }}
      </view>
    </view>

    <UseAttrsFeature
      title="组件内 useAttrs()"
      :state-class="currentToneClass"
      :visible="controlState.visible"
      :badge-style="currentBadgeStyle"
      :extra-label="currentExtraLabel"
      :seed-tag="controlState.seed"
    />
  </view>
</template>

<style scoped>
.use-attrs-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f8fafc;
}

.use-attrs-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.use-attrs-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.use-attrs-page__toolbar {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-attrs-page__btn {
  margin: 6rpx;
  min-height: 58rpx;
  line-height: 58rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.ctrl-on {
  background: #bbf7d0;
}

.ctrl-off {
  background: #fecaca;
}

.ctrl-dash {
  color: #334155;
}

.ctrl-solid {
  color: #0f172a;
}
</style>
