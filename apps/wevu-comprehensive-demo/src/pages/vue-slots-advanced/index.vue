<script setup lang="ts">
import { computed, ref } from 'wevu'

const slotName = ref<'header' | 'footer'>('header')
const counter = ref(0)

const label = computed(() => (slotName.value === 'header' ? '#header' : '#footer'))

function toggleSlot() {
  slotName.value = slotName.value === 'header' ? 'footer' : 'header'
}

function increment() {
  counter.value += 1
}
</script>

<template>
  <view class="container">
    <view class="page-title">插槽进阶</view>

    <view class="section">
      <view class="section-title">具名 / 作用域 / 动态插槽名</view>
      <view class="demo-item">
        <text class="label">动态插槽：{{ label }}</text>
        <button class="btn btn-primary" @click="toggleSlot">切换</button>
      </view>
      <view class="demo-item">
        <text class="label">counter: {{ counter }}</text>
        <button class="btn btn-success" @click="increment">+1</button>
      </view>

      <vue-slot-lab title="Slot Lab" subtitle="覆盖 v-slot / # / 动态插槽">
        <template #[slotName]>
          <view class="slot-box">
            <text class="slot-title">{{ label }} content</text>
            <text class="slot-muted">counter={{ counter }}</text>
          </view>
        </template>

        <template #default="{ items, now }">
          <view class="slot-box">
            <text class="slot-title">默认插槽（作用域参数）</text>
            <text class="slot-muted">now(): {{ now() }}</text>
            <view class="chips">
              <view v-for="item in items" :key="item.id" class="chip">
                <text>{{ item.name }}</text>
              </view>
            </view>
          </view>
        </template>

        <template #footer="{ time }">
          <view class="slot-box">
            <text class="slot-title">#footer scope</text>
            <text class="slot-muted">time={{ time }}</text>
          </view>
        </template>
      </vue-slot-lab>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.slot-box {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.slot-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.slot-muted {
  font-size: 22rpx;
  color: #64748b;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chip {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 22rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "插槽进阶",
  "usingComponents": {
    "vue-slot-lab": "/components/vue-slot-lab/index"
  }
}
</config>
