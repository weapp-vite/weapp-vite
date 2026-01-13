<script setup lang="ts">
import { computed, reactive, ref, watch } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: 'Class 绑定',
  backgroundColor: '#f6f7fb',
})

const isActive = ref(true)
const hasError = ref(false)
const isRound = ref(false)
const isGhost = ref(false)

const classObject = reactive({
  'demo-active': true,
  'text-danger': false,
  'demo-round': false,
  'demo-ghost': false,
})

watch([isActive, hasError, isRound, isGhost], ([active, error, round, ghost]) => {
  classObject['demo-active'] = active
  classObject['text-danger'] = error
  classObject['demo-round'] = round
  classObject['demo-ghost'] = ghost
}, { immediate: true })

const activeClass = ref('demo-active')
const errorClass = ref('text-danger')
const roundClass = ref('demo-round')
const ghostClass = ref('demo-ghost')

const activeClassIf = computed(() => (isActive.value ? activeClass.value : ''))
const errorClassIf = computed(() => (hasError.value ? errorClass.value : ''))
const roundClassIf = computed(() => (isRound.value ? roundClass.value : ''))
const ghostClassIf = computed(() => (isGhost.value ? ghostClass.value : ''))
const dynamicKeyClass = computed(() => ({ [activeClass.value]: isActive.value }))
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#eef2ff] via-[#ffffff] to-[#e0f2fe] p-[20rpx]">
      <SectionTitle title="Class 绑定实验室" subtitle="切换状态观察 Vue 3 class 绑定效果" />
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="状态控制" subtitle="开关影响所有示例" />
      <view class="mt-[12rpx] grid grid-cols-2 gap-[12rpx]">
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Active
            </text>
            <t-switch :value="isActive" @change="(e) => (isActive = e.detail.value)" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Error
            </text>
            <t-switch :value="hasError" @change="(e) => (hasError = e.detail.value)" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Round
            </text>
            <t-switch :value="isRound" @change="(e) => (isRound = e.detail.value)" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Ghost
            </text>
            <t-switch :value="isGhost" @change="(e) => (isGhost = e.detail.value)" />
          </view>
        </view>
      </view>
    </view>

    <view class="mt-[18rpx] space-y-[14rpx]">
      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="对象语法" subtitle="状态驱动 class" />
        <view class="mt-[12rpx] demo-block" :class="{ 'demo-active': isActive }">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Object Syntax
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              active 触发高亮
            </text>
          </view>
          <view class="demo-chip">
            Obj
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="静态 + 对象" subtitle="静态 class + 动态对象" />
        <view class="mt-[12rpx] demo-block demo-ghost" :class="{ 'demo-active': isActive, 'text-danger': hasError }">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Static + Object
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              error 显示警示色
            </text>
          </view>
          <view class="demo-chip">
            Mix
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="响应式对象" subtitle="reactive classObject" />
        <view class="mt-[12rpx] demo-block" :class="classObject">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Reactive Object
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              多状态合并控制
            </text>
          </view>
          <view class="demo-chip">
            Obj+
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组语法" subtitle="数组传入多个 class" />
        <view class="mt-[12rpx] demo-block" :class="[activeClassIf, errorClassIf, roundClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Array Syntax
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              组合多个 class
            </text>
          </view>
          <view class="demo-chip">
            Arr
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组条件" subtitle="条件判断决定 class" />
        <view class="mt-[12rpx] demo-block" :class="[isActive ? activeClass : '', errorClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Conditional Array
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              条件表达式返回 class
            </text>
          </view>
          <view class="demo-chip">
            Cond
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组 + 动态 key" subtitle="对象 + 字符串混合" />
        <view class="mt-[12rpx] demo-block" :class="[dynamicKeyClass, errorClassIf, ghostClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Array + Key
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#6f6b8a]">
              支持计算属性 key
            </text>
          </view>
          <view class="demo-chip">
            Key
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.demo-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  border: 2rpx solid #d7d9f2;
  background: #ffffff;
  color: #1f1a3f;
  border-radius: 18rpx;
  transition: all 0.2s ease;
}

.demo-chip {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  border: 2rpx solid currentColor;
  letter-spacing: 0.5rpx;
}

.demo-ghost {
  background: #f8fafc;
  border-style: dashed;
}

.demo-round {
  border-radius: 999rpx;
}

.demo-active {
  background: linear-gradient(135deg, #2563eb, #6366f1);
  border-color: #1e40af;
  color: #ffffff;
  box-shadow: 0 18rpx 32rpx rgba(37, 99, 235, 0.35);
  transform: translateY(-4rpx);
}

.text-danger {
  background: #fff1f2;
  border-color: #ef4444;
  color: #b91c1c;
  box-shadow: 0 18rpx 32rpx rgba(239, 68, 68, 0.2);
}
</style>
