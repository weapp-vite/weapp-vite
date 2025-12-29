<script setup lang="ts">
import { computed, ref } from 'wevu'

const active = ref(true)
const level = ref<'info' | 'warning' | 'danger'>('info')
const size = ref<'sm' | 'md' | 'lg'>('md')

const plainClass = computed(() => (active.value ? 'active' : 'inactive'))
const classArray = computed(() => [plainClass.value, size.value])
const classObject = computed(() => ({
  active: active.value,
  inactive: !active.value,
  warning: level.value === 'warning',
  danger: level.value === 'danger',
}))

const styleString = computed(() => `border-color: ${active.value ? '#22c55e' : '#e2e8f0'};`)
const styleObject = computed(() => ({
  background: active.value ? '#ecfeff' : '#f8fafc',
  color: active.value ? '#0f172a' : '#475569',
}))
const styleArray = computed(() => [styleObject.value, { padding: '18rpx' }])

const attrs = ref({
  'data-from': 'v-bind',
  'data-level': level.value,
})

function toggleActive() {
  active.value = !active.value
}

function rotateLevel() {
  level.value = level.value === 'info' ? 'warning' : level.value === 'warning' ? 'danger' : 'info'
  attrs.value = { ...attrs.value, 'data-level': level.value }
}

function rotateSize() {
  size.value = size.value === 'sm' ? 'md' : size.value === 'md' ? 'lg' : 'sm'
}
</script>

<template>
  <view class="container">
    <view class="page-title">属性与样式绑定</view>

    <view class="section">
      <view class="section-title">v-bind（简写 : ）</view>
      <view class="demo-item">
        <text class="label">active: {{ active }}</text>
        <button class="btn btn-primary" @click="toggleActive">切换</button>
      </view>
      <view class="demo-item">
        <text class="label">level: {{ level }}</text>
        <button class="btn btn-success" @click="rotateLevel">切换</button>
      </view>
      <view class="demo-item">
        <text class="label">size: {{ size }}</text>
        <button class="btn btn-info" @click="rotateSize">切换</button>
      </view>

      <view class="card">
        <view class="box" :class="plainClass">
          <text>:class (string) => {{ plainClass }}</text>
        </view>
        <view class="box" :class="classArray">
          <text>:class (array) => {{ classArray.join(' ') }}</text>
        </view>
        <view class="box" :class="classObject">
          <text>:class (object) => {{ JSON.stringify(classObject) }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">:style（string / object / array）</view>
      <view class="card">
        <view class="box" :style="styleString">
          <text>:style (string) => {{ styleString }}</text>
        </view>
        <view class="box" :style="styleObject">
          <text>:style (object) => {{ JSON.stringify(styleObject) }}</text>
        </view>
        <view class="box" :style="styleArray">
          <text>:style (array) => {{ JSON.stringify(styleArray) }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">v-bind="object" 透传属性</view>
      <view class="card">
        <view class="box" v-bind="attrs" :data-active="String(active)" :data-size="size">
          <text>v-bind="attrs"</text>
          <text class="muted">{{ JSON.stringify(attrs) }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">v-cloak（编译后移除）</view>
      <view class="card">
        <text v-cloak>v-cloak: {{ active }}</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.box {
  padding: 18rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  border: 2rpx solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
}

.active {
  border-color: #22c55e;
}

.inactive {
  border-color: #e2e8f0;
}

.warning {
  background: #fff7ed;
}

.danger {
  background: #fef2f2;
}

.sm {
  font-size: 22rpx;
}

.md {
  font-size: 26rpx;
}

.lg {
  font-size: 30rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "属性绑定",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</config>
