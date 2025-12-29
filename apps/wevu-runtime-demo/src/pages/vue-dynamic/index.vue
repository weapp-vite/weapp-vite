<script setup lang="ts">
import { computed, ref } from 'wevu'

type Panel = 'a' | 'b'

const keepAlive = ref(true)
const panel = ref<Panel>('a')
const showTip = ref(true)
const group = ref([1, 2, 3])

const currentComponent = computed(() => (panel.value === 'a' ? 'vue-dynamic-a' : 'vue-dynamic-b'))

function togglePanel() {
  panel.value = panel.value === 'a' ? 'b' : 'a'
}

function toggleKeepAlive() {
  keepAlive.value = !keepAlive.value
}

function toggleTip() {
  showTip.value = !showTip.value
}

function shuffleGroup() {
  group.value = [...group.value].reverse()
}
</script>

<template>
  <view class="container">
    <view class="page-title">动态组件与内置组件</view>

    <view class="section">
      <view class="section-title">component :is / keep-alive / transition</view>
      <view class="card">
        <view class="actions">
          <button size="mini" class="btn btn-primary" @tap="togglePanel">切换组件</button>
          <button size="mini" class="btn btn-success" @tap="toggleKeepAlive">
            keepAlive: {{ keepAlive }}
          </button>
          <button size="mini" class="btn btn-info" @tap="toggleTip">切换 tip</button>
        </view>

        <keep-alive v-if="keepAlive">
          <component :is="currentComponent" />
        </keep-alive>
        <component v-else :is="currentComponent" />

        <transition name="fade">
          <view v-if="showTip" class="tip">
            <text>transition: {{ panel }}</text>
          </view>
        </transition>
      </view>
    </view>

    <view class="section">
      <view class="section-title">transition-group（语法覆盖）</view>
      <view class="card">
        <view class="actions">
          <button size="mini" class="btn btn-warning" @tap="shuffleGroup">reverse</button>
        </view>
        <transition-group name="fade" tag="view">
          <view v-for="n in group" :key="n" class="pill">
            <text>{{ n }}</text>
          </view>
        </transition-group>
      </view>
    </view>

    <view class="section">
      <view class="section-title">teleport / suspense（语法覆盖）</view>
      <view class="card">
        <teleport to="#anywhere">
          <view class="tip">
            <text>teleport to="#anywhere"</text>
          </view>
        </teleport>
        <suspense>
          <template #default>
            <view class="tip">
              <text>suspense default</text>
            </view>
          </template>
          <template #fallback>
            <view class="tip">
              <text>suspense fallback</text>
            </view>
          </template>
        </suspense>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.btn {
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
}

.btn-primary {
  background: #111827;
  color: #ffffff;
}

.btn-success {
  background: #2563eb;
  color: #ffffff;
}

.btn-info {
  background: #0ea5e9;
  color: #ffffff;
}

.btn-warning {
  background: #f59e0b;
  color: #111827;
}

.tip {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #ebf4ff;
  color: #2b6cb0;
}

.pill {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "动态组件",
  "usingComponents": {
    "vue-dynamic-a": "/components/vue-dynamic-a/index",
    "vue-dynamic-b": "/components/vue-dynamic-b/index",
    "transition-group": "/components/vue-transition-group/index",
    "teleport": "/components/vue-teleport/index",
    "suspense": "/components/vue-suspense/index"
  }
}
</config>
