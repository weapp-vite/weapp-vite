<script setup lang="ts">
import { computed, nextTick, provide, provideGlobal, reactive } from 'wevu'
import UseProvideInjectFeature from '../../components/use-provide-inject-feature/index.vue'

type UpdateSource = 'provider' | 'inject'
type ThemeName = 'teal' | 'amber'

interface SharedState {
  count: number
  theme: ThemeName
  lastAction: string
}

const PROVIDE_INJECT_KEY = 'wevu-features:provide-inject'

const sharedState = reactive<SharedState>({
  count: 1,
  theme: 'teal',
  lastAction: 'init:provider',
})

function markAction(action: 'inc' | 'theme', source: UpdateSource) {
  sharedState.lastAction = `${action}:${source}`
}

function increment(source: UpdateSource = 'provider') {
  sharedState.count += 1
  markAction('inc', source)
}

function toggleTheme(source: UpdateSource = 'provider') {
  sharedState.theme = sharedState.theme === 'teal' ? 'amber' : 'teal'
  markAction('theme', source)
}

function providerIncrementTap() {
  increment('provider')
}

function providerToggleThemeTap() {
  toggleTheme('provider')
}

const panelClassName = computed(() => (sharedState.theme === 'teal' ? 'theme-teal' : 'theme-amber'))
const sharedApi = {
  state: sharedState,
  increment,
  toggleTheme,
}

provide(PROVIDE_INJECT_KEY, sharedApi)
provideGlobal(PROVIDE_INJECT_KEY, sharedApi)

async function runE2E() {
  const before = {
    count: sharedState.count,
    theme: sharedState.theme,
    lastAction: sharedState.lastAction,
  }

  increment('provider')
  toggleTheme('provider')
  await nextTick()

  const checks = {
    countChanged: sharedState.count !== before.count,
    themeChanged: sharedState.theme !== before.theme,
    actionChanged: sharedState.lastAction !== before.lastAction,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      count: sharedState.count,
      theme: sharedState.theme,
      lastAction: sharedState.lastAction,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="use-provide-inject-page">
    <view class="use-provide-inject-page__title">
      wevu provide / inject 特性展示
    </view>
    <view class="use-provide-inject-page__subtitle">
      provider 与 inject 共同操作同一份状态，验证跨层响应式同步
    </view>

    <view class="use-provide-inject-page__toolbar">
      <view id="provide-inc" class="use-provide-inject-page__btn" @tap="providerIncrementTap">
        provider -> increment
      </view>
      <view id="provide-toggle-theme" class="use-provide-inject-page__btn" @tap="providerToggleThemeTap">
        provider -> toggle theme
      </view>
    </view>

    <view id="provide-state" class="use-provide-inject-page__state" :class="panelClassName">
      provider theme = {{ sharedState.theme }}
    </view>
    <view id="provide-count" class="use-provide-inject-page__line">
      provider count = {{ sharedState.count }}
    </view>
    <view id="provide-last-action" class="use-provide-inject-page__line">
      last action = {{ sharedState.lastAction }}
    </view>

    <UseProvideInjectFeature title="组件内 inject()" />
  </view>
</template>

<style scoped>
.use-provide-inject-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f8fafc;
}

.use-provide-inject-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.use-provide-inject-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.use-provide-inject-page__toolbar {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-provide-inject-page__btn {
  margin: 6rpx;
  min-height: 58rpx;
  line-height: 58rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.use-provide-inject-page__state {
  margin-top: 12rpx;
  padding: 8rpx 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.use-provide-inject-page__line {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #334155;
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
