<script setup lang="ts">
import { computed, inject, reactive } from 'wevu'

type UpdateSource = 'provider' | 'inject'
type ThemeName = 'teal' | 'amber'

interface InjectedFeatureState {
  count: number
  theme: ThemeName
  lastAction: string
}

interface InjectedFeatureApi {
  state: InjectedFeatureState
  increment: (source?: UpdateSource) => void
  toggleTheme: (source?: UpdateSource) => void
}

const props = defineProps<{
  title: string
}>()

const injectedApi = inject<InjectedFeatureApi | null>('wevu-features:provide-inject', null)
const fallbackState = reactive<InjectedFeatureState>({
  count: -1,
  theme: 'teal',
  lastAction: 'inject-missing',
})
const injectedState = injectedApi?.state ?? fallbackState
const panelClassName = computed(() => (injectedState.theme === 'teal' ? 'theme-teal' : 'theme-amber'))

function incrementFromInject() {
  injectedApi?.increment('inject')
}

function toggleThemeFromInject() {
  injectedApi?.toggleTheme('inject')
}
</script>

<template>
  <view class="provide-inject-feature">
    <view class="provide-inject-feature__title">
      {{ props.title }}
    </view>

    <view id="inject-panel" class="provide-inject-feature__panel" :class="panelClassName">
      inject theme = {{ injectedState.theme }}
    </view>

    <view id="inject-count" class="provide-inject-feature__line">
      inject count = {{ injectedState.count }}
    </view>
    <view id="inject-last-action" class="provide-inject-feature__line">
      last action = {{ injectedState.lastAction }}
    </view>

    <view class="provide-inject-feature__actions">
      <view id="inject-inc" class="provide-inject-feature__btn" @tap="incrementFromInject">
        inject -> increment
      </view>
      <view id="inject-toggle-theme" class="provide-inject-feature__btn" @tap="toggleThemeFromInject">
        inject -> toggle theme
      </view>
    </view>
  </view>
</template>

<style scoped>
.provide-inject-feature {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid #cbd5e1;
  background: #fff;
}

.provide-inject-feature__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.provide-inject-feature__panel {
  margin-top: 14rpx;
  padding: 10rpx 16rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.provide-inject-feature__line {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #334155;
}

.provide-inject-feature__actions {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.provide-inject-feature__btn {
  margin: 6rpx;
  min-height: 56rpx;
  line-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.theme-teal {
  color: #0f766e;
  background: #ccfbf1;
}

.theme-amber {
  color: #92400e;
  background: #fef3c7;
}
</style>
